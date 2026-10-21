import 'dotenv/config';
import fs from 'node:fs/promises';
import {Client,GatewayIntentBits,Events,ActivityType,PermissionFlagsBits} from 'discord.js';
import {DuckStore} from './store.mjs';
import {commandPayloads,runCommand} from './commands.mjs';
import {askCloudflare,cannedAnswer,MODEL,pickName,safeResponse,stripMentions} from './brain.mjs';

const TOKEN=process.env.DISCORD_TOKEN?.trim();
const GUILD_ID=process.env.DISCORD_GUILD_ID?.trim();
const CLIENT_ID=process.env.DISCORD_CLIENT_ID?.trim();
if(!TOKEN||!GUILD_ID||!CLIENT_ID){
  console.error('Faltam DISCORD_TOKEN, DISCORD_CLIENT_ID ou DISCORD_GUILD_ID. Configure as variáveis no Railway (não publique as chaves).');
  process.exit(1);
}
const SITE=process.env.WEBSITE_URL?.startsWith('https://')?process.env.WEBSITE_URL:'https://duckzincommunity.vercel.app';
const PANEL_ID=/^\d{17,22}$/.test(process.env.SUPPORT_PANEL_CHANNEL_ID||'')?process.env.SUPPORT_PANEL_CHANNEL_ID:'';
const CF_ACCOUNT=process.env.CF_ACCOUNT_ID?.trim()||'';
const CF_TOKEN=process.env.CF_API_TOKEN?.trim()||'';
const CF_MODEL=process.env.CF_MODEL?.trim()||MODEL;
const DAY_CAP=Math.min(500,Math.max(1,Number(process.env.DAILY_AI_LIMIT)||70));
const DELETE_AFTER=Math.max(5,Math.min(60,Number(process.env.DELETE_AFTER_MINUTES)||20))*60_000;

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const store=new DuckStore({url:process.env.SUPABASE_URL,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,guildId:GUILD_ID});
const session=new Map(),busy=new Set(),cooldown=new Map(),allTimes=[],perUserTimes=new Map(),deleteTimers=new Map();
let localKnowledge={};
try { localKnowledge=JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf-8')); }
catch {console.warn('[Duckzinha] knowledge.json ausente; usando apenas as respostas internas.');}

function getHistory(userId){
  const obj=session.get(userId);
  if(!obj||Date.now()-obj.updated>45*60_000){session.delete(userId);return []}
  return obj.items.slice(-8);
}
function addHistory(userId,question,answer){
  const items=getHistory(userId);
  items.push({role:'user',content:question.slice(0,800)},{role:'assistant',content:answer.slice(0,800)});
  session.set(userId,{items:items.slice(-8),updated:Date.now()});
}
function canUseAI(userId){
  const now=Date.now(),start=now-24*60*60_000;
  while(allTimes.length&&allTimes[0]<start)allTimes.shift();
  const u=(perUserTimes.get(userId)||[]).filter(t=>t>=start);
  perUserTimes.set(userId,u);
  if(allTimes.length>=DAY_CAP||u.length>=24)return false;
  allTimes.push(now);u.push(now);return true;
}
async function removeOwnMessage(messageId,channelId){
  try{
    const channel=await client.channels.fetch(channelId).catch(()=>null);
    if(channel?.isTextBased()&&channel.messages?.fetch){
      const msg=await channel.messages.fetch(messageId).catch(()=>null);
      if(msg&&msg.author.id===client.user?.id)await msg.delete().catch(err=>{throw err});
    }
    await store.removeMessage(messageId);
  }catch(err){console.warn('[Duckzinha] Não consegui apagar mensagem '+messageId+': '+err.message)}
  finally{deleteTimers.delete(messageId)}
}
async function schedule(message){
  if(!message?.id||!message.channelId||!message.guildId||message.author?.id!==client.user?.id)return;
  const expiresAt=Date.now()+DELETE_AFTER;
  try { await store.registerMessage({messageId:message.id,channelId:message.channelId,expiresAt}); }
  catch(e){console.warn('[Duckzinha] Falha no agendamento persistente: '+e.message)}
  if(deleteTimers.has(message.id))clearTimeout(deleteTimers.get(message.id));
  const timer=setTimeout(()=>{void removeOwnMessage(message.id,message.channelId)},DELETE_AFTER);
  timer.unref?.();deleteTimers.set(message.id,timer);
}
async function cleanupExpired(){
  try{
    for(const item of await store.getExpiredMessages())await removeOwnMessage(item.message_id,item.channel_id);
  }catch(err){console.warn('[Duckzinha] Limpeza persistente: '+err.message)}
}
async function communityKnowledge(){
  const rows=await store.loadKnowledge().catch(err=>{console.warn('[Duckzinha] Falha ao ler ensinos: '+err.message);return []});
  const merged={...localKnowledge};
  for(const {topic,answer} of rows)merged[topic]=answer;
  return merged;
}
function helpWithTicket(question,answer){
  if(!/\b(erro|bug|não funciona|nao funciona|crash|instalar|problema|nao abre|não abre|falha)\b/i.test(question))return answer;
  if(/ticket/i.test(answer))return answer;
  return answer+'\n\n🎫 Se não resolver, abre um ticket e aguarda um atendente da equipe, tá? 💛';
}

client.once(Events.ClientReady,async me=>{
  console.log('[Duckzinha] Online como '+me.user.tag+' (bot separado).');
  me.user.setActivity('🦆💛 | /ajuda • mencione a Duckzinha',{type:ActivityType.Custom});
  try{
    const guild=await me.guilds.fetch(GUILD_ID);
    await guild.commands.set(commandPayloads());
    console.log('[Duckzinha] Comandos cadastrados no servidor '+guild.name+'.');
  }catch(e){console.error('[Duckzinha] Erro ao cadastrar comandos: '+e.message)}
  console.log('[Duckzinha] IA: '+(CF_ACCOUNT&&CF_TOKEN?CF_MODEL:'modo básico (sem chave de IA)')+'. Memória persistente: '+(store.persistent?'ativada':'não configurada')+'.');
  void cleanupExpired();
  const timer=setInterval(()=>{
    void cleanupExpired();
    const now=Date.now();for(const [key,obj] of session)if(now-obj.updated>45*60_000)session.delete(key);
  },60_000);timer.unref?.();
});

client.on(Events.MessageCreate,async message=>{
  if(!message.inGuild()||message.guildId!==GUILD_ID||message.author.bot)return;
  if(!client.user||!message.mentions.users.has(client.user.id))return;
  if(!message.content.includes('<@'+client.user.id+'>')&&!message.content.includes('<@!'+client.user.id+'>'))return;
  const id=message.author.id;
  if(busy.has(id))return;
  if(Date.now()-(cooldown.get(id)||0)<7500)return;
  const question=stripMentions(message.content,client.user.id);
  if(!question){
    const r=await message.reply({content:'Oiee! 🦆💛 Me conta sua dúvida depois de me mencionar! Quer ver meus comandos? Usa `/ajuda` ✨',allowedMentions:{repliedUser:false,parse:[]}}).catch(()=>null);
    if(r)await schedule(r);return;
  }
  if(question.length<2)return;
  busy.add(id);cooldown.set(id,Date.now());
  try{
    const member=await store.getMember(id).catch(()=>null);
    const newName=member?.enabled?pickName(question):null;
    if(newName&&newName!==member.preferred_name)await store.rememberName(id,newName).catch(()=>{});
    const latestName=newName||member?.preferred_name||'';
    const facts=await communityKnowledge();
    let answer=null;
    const modelReady=Boolean(CF_ACCOUNT&&CF_TOKEN);
    if(modelReady&&canUseAI(id)){
      try{
        answer=await askCloudflare({accountId:CF_ACCOUNT,token:CF_TOKEN,model:CF_MODEL,
          question,history:getHistory(id),knowledge:Object.entries(facts).map(([k,v])=>k+': '+v).join('\n'),name:latestName});
      }catch(e){console.warn('[Duckzinha] IA temporariamente indisponível ('+e.message+'); usando resposta básica.')}
    }
    answer=safeResponse(answer||cannedAnswer(question,facts))||'Oiee! 💛 Pode explicar um pouquinho melhor?';
    if(/\b(quem sou eu|lembra de mim|qual meu nome)\b/i.test(question))answer=latestName?'Clarooo! Você me contou que gosta de ser chamado de **'+latestName+'**! 🦆💛':'Aii, ainda não sei seu nome! 💛 Se quiser que eu lembre, ativa `/memoria ativar` e se apresenta quando me mencionar.';
    if(newName&&!/\b(quem sou|meu nome)\b/i.test(question))answer='Aaa, prazer, '+newName+'! 💛 '+answer;
    answer=helpWithTicket(question,answer);
    addHistory(id,question,answer);
    const sent=await message.reply({content:answer.slice(0,1900),allowedMentions:{repliedUser:false,parse:[]}}).catch(err=>{console.warn('[Duckzinha] Falha na resposta: '+err.message);return null});
    if(sent)await schedule(sent);
  }catch(error){
    console.error('[Duckzinha] Erro ao conversar: '+error.message);
    const msg=await message.reply({content:'Aii, tive um probleminha aqui 🥺💛 Pode tentar de novo? Se for urgente, abre um ticket pra equipe.',allowedMentions:{repliedUser:false,parse:[]}}).catch(()=>null);
    if(msg)void schedule(msg);
  }finally{busy.delete(id)}
});

client.on(Events.InteractionCreate,async interaction=>{
  if(!interaction.isChatInputCommand())return;
  try{
    await runCommand(interaction,{store,site:SITE,panelId:PANEL_ID,schedule,localKnowledge,client});
  }catch(error){
    console.error('[Duckzinha] Comando '+interaction.commandName+': '+error.message);
    const data={content:'Aii, não consegui fazer isso agora 🥺💛 Tenta de novo daqui a pouquinho!',ephemeral:true};
    if(interaction.replied||interaction.deferred)await interaction.followUp(data).catch(()=>{});
    else await interaction.reply(data).catch(()=>{});
  }
});
client.on(Events.Error,error=>console.error('[Duckzinha] Discord: '+error.message));
process.on('unhandledRejection',error=>console.error('[Duckzinha] Erro inesperado: '+String(error?.message||error)));

await client.login(TOKEN);
