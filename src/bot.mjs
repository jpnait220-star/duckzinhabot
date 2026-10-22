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
const DELETE_AFTER=Math.max(5,Math.min(60,Number(process.env.DELETE_AFTER_MINUTES)||20))*60_000;

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const store=new DuckStore({url:process.env.SUPABASE_URL,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,guildId:GUILD_ID});
const session=new Map(),busy=new Map(),cooldown=new Map(),deleteTimers=new Map();
let personalityCache={value:'',expires:0};
function invalidatePersonality(){personalityCache.expires=0;}
async function getPersonality(){
  if(personalityCache.expires>Date.now())return personalityCache.value;
  try{
    const value=await store.getPersonalityPrompt();
    personalityCache={value,expires:Date.now()+120000};
    return value;
  }catch(e){console.warn('[Duckzinha] Personalidade: '+e.message);return personalityCache.value;}
}

let localKnowledge={};
try { localKnowledge=JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf-8')); }
catch {console.warn('[Duckzinha] knowledge.json ausente; usando apenas as respostas internas.');}

async function getHistory(userId){
  const obj=session.get(userId);
  if(obj&&Date.now()-obj.updated<45*60_000)return obj.items.slice(-12);
  const items=await store.getConversation(userId).catch(err=>{
    console.warn('[Duckzinha] Falha ao ler histórico: '+err.message);return [];
  });
  session.set(userId,{items,updated:Date.now()});
  return items;
}
async function addHistory(userId,question,answer){
  const items=await getHistory(userId);
  items.push({role:'user',content:question.slice(0,800)},
    {role:'assistant',content:answer.slice(0,800)});
  const recent=items.slice(-12);
  session.set(userId,{items:recent,updated:Date.now()});
  await store.saveConversation(userId,recent).catch(err=>
    console.warn('[Duckzinha] Falha ao guardar histórico: '+err.message));
}
function clearSession(userId){
  if(userId)session.delete(userId);else session.clear();
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
  void store.cleanupConversations().catch(e=>console.warn('[Duckzinha] Limpeza de histórico: '+e.message));
  const timer=setInterval(()=>{
    void cleanupExpired();
    const now=Date.now();for(const [key,obj] of session)if(now-obj.updated>45*60_000)session.delete(key);
  },60_000);timer.unref?.();
  // Discord normally reconnects on its own. Restart only if the gateway
  // remains disconnected for over two minutes (FadeHost restarts crashed bots).
  let disconnectedSince=0;
  const watchdog=setInterval(()=>{
    if(client.isReady()){disconnectedSince=0;return;}
    if(!disconnectedSince){
      disconnectedSince=Date.now();
      console.warn('[Duckzinha] Discord desconectado; aguardando reconexão automática.');
    }else if(Date.now()-disconnectedSince>120000){
      console.error('[Duckzinha] Discord não reconectou em 2 minutos; reiniciando processo.');
      process.exit(1);
    }
  },30000);
  watchdog.unref?.();
});

client.on(Events.MessageCreate,async message=>{
  if(!message.inGuild()||message.guildId!==GUILD_ID||message.author.bot)return;
  if(!client.user||!message.mentions.users.has(client.user.id))return;
  if(!message.content.includes('<@'+client.user.id+'>')&&!message.content.includes('<@!'+client.user.id+'>'))return;
  const id=message.author.id;
  const previous=busy.get(id);
  if(previous&&Date.now()-previous<60000)return;
  if(previous)console.warn('[Duckzinha] Liberando atendimento antigo preso há mais de 60s.');
  if(Date.now()-(cooldown.get(id)||0)<7500)return;
  const question=stripMentions(message.content,client.user.id);
  if(!question){
    const r=await message.reply({content:'Oiee! 🦆💛 Me conta sua dúvida depois de me mencionar! Quer ver meus comandos? Usa `/ajuda` ✨',allowedMentions:{repliedUser:false,parse:[]}}).catch(()=>null);
    if(r)void schedule(r).catch(err=>console.warn('[Duckzinha] Limpeza agendada: '+err.message));return;
  }
  if(question.length<2)return;
  const requestStarted=Date.now();
  busy.set(id,requestStarted);cooldown.set(id,requestStarted);
  console.log('[Duckzinha] Menção recebida; iniciando resposta.');
  try{
    // Independent lookups run concurrently; Supabase reads have an 8s deadline.
    const [member,facts,history,personality]=await Promise.all([
      store.getMember(id).catch(err=>{console.warn('[Duckzinha] Nome: '+err.message);return null}),
      communityKnowledge(),
      getHistory(id),
      getPersonality()
    ]);
    const newName=pickName(question);
    if(newName&&newName!==member?.preferred_name)
      void store.rememberName(id,newName).catch(err=>console.warn('[Duckzinha] Salvar nome: '+err.message));
    const latestName=newName||member?.preferred_name||'';
    let answer=null,aiAnswered=false;
    const modelReady=Boolean(CF_ACCOUNT&&CF_TOKEN);
    if(modelReady){
      try{
        answer=await askCloudflare({accountId:CF_ACCOUNT,token:CF_TOKEN,model:CF_MODEL,
          question,history,customPersonality:personality,knowledge:Object.entries(facts).map(([k,v])=>k+': '+v).join('\n'),name:latestName});
        aiAnswered=Boolean(answer);
      }catch(e){console.warn('[Duckzinha] IA temporariamente indisponível ('+e.message+'); usando resposta básica.')}
    }
    answer=safeResponse(answer||cannedAnswer(question,facts))||'Oiee! 💛 Pode explicar um pouquinho melhor?';
    if(/\b(quem sou eu|lembra de mim|qual meu nome)\b/i.test(question))answer=latestName?'Clarooo! Você me contou que gosta de ser chamado de **'+latestName+'**! 🦆💛':'Aii, ainda não sei seu nome! 💛 Pode se apresentar quando me mencionar, se quiser!';
    if(newName&&!/\b(quem sou|meu nome)\b/i.test(question))answer='Aaa, prazer, '+newName+'! 💛 '+answer;
    answer=helpWithTicket(question,answer);
    const sent=await message.reply({content:answer.slice(0,1900),allowedMentions:{repliedUser:false,parse:[]}}).catch(err=>{console.warn('[Duckzinha] Falha na resposta: '+err.message);return null});
    if(sent){
      // Never wait for background database writes before releasing the user.
      if(modelReady&&aiAnswered)
        void addHistory(id,question,answer).catch(err=>console.warn('[Duckzinha] Histórico: '+err.message));
      void schedule(sent).catch(err=>console.warn('[Duckzinha] Limpeza agendada: '+err.message));
      console.log('[Duckzinha] Resposta enviada ao Discord.');
    }
  }catch(error){
    console.error('[Duckzinha] Erro ao conversar: '+error.message);
    const msg=await message.reply({content:'Aii, tive um probleminha aqui 🥺💛 Pode tentar de novo? Se for urgente, abre um ticket pra equipe.',allowedMentions:{repliedUser:false,parse:[]}}).catch(()=>null);
    if(msg)void schedule(msg).catch(err=>console.warn('[Duckzinha] Limpeza agendada: '+err.message));
  }finally{
    if(busy.get(id)===requestStarted)busy.delete(id);
  }
});

client.on(Events.InteractionCreate,async interaction=>{
  if(!interaction.isChatInputCommand())return;
  try{
    await runCommand(interaction,{store,site:SITE,panelId:PANEL_ID,schedule,localKnowledge,client,clearSession,invalidatePersonality});
  }catch(error){
    console.error('[Duckzinha] Comando '+interaction.commandName+': '+error.message);
    const data={content:'Aii, não consegui fazer isso agora 🥺💛 Tenta de novo daqui a pouquinho!',ephemeral:true};
    if(interaction.replied||interaction.deferred)await interaction.followUp(data).catch(()=>{});
    else await interaction.reply(data).catch(()=>{});
  }
});
client.on(Events.ShardDisconnect,(event,shardId)=>
  console.warn('[Duckzinha] Gateway desconectado (shard '+shardId+', código '+event.code+').'));
client.on(Events.ShardReconnecting,shardId=>
  console.warn('[Duckzinha] Gateway reconectando (shard '+shardId+').'));
client.on(Events.ShardResume,shardId=>
  console.log('[Duckzinha] Gateway recuperado (shard '+shardId+').'));
client.on(Events.Error,error=>console.error('[Duckzinha] Discord: '+error.message));
process.on('unhandledRejection',error=>console.error('[Duckzinha] Erro inesperado: '+String(error?.message||error)));

await client.login(TOKEN);
