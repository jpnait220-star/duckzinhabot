import 'dotenv/config';
import fs from 'node:fs/promises';
import {Client,GatewayIntentBits,Events,ActivityType,PermissionFlagsBits} from 'discord.js';
import {DuckStore} from './store.mjs';
import {commandPayloads,runCommand} from './commands.mjs';
import {askCloudflare,cannedAnswer,MODEL,pickName,safeResponse,stripMentions,formatChannelContext} from './brain.mjs';
import {researchTopic} from './research.mjs';
import {broadWebSearch,webResearchContext,researchCitations,wantsWebResearch,uncertainty,decision,answerIgnoresWebResults} from './web-research.mjs';

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
const TAVILY_KEY=process.env.TAVILY_API_KEY?.trim()||'';
const SERPER_KEY=process.env.SERPER_API_KEY?.trim()||'';
const DELETE_AFTER=Math.max(5,Math.min(60,Number(process.env.DELETE_AFTER_MINUTES)||20))*60_000;

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const store=new DuckStore({url:process.env.SUPABASE_URL,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,guildId:GUILD_ID});
const session=new Map(),busy=new Map(),cooldown=new Map(),deleteTimers=new Map(),pendingResearch=new Map();
const serverRecent=[]; // Conversa recente dos canais públicos, só em RAM.
let sharedTurns=[],sharedReady=Promise.resolve(),sharedWrite=Promise.resolve();
const CHAT_AGE=48*60*60_000;
function publicChannel(message){
  const c=message.channel;
  const everyone=message.guild?.roles?.everyone;
  return Boolean(everyone&&c?.isTextBased?.()&&!c.isThread?.()&&!c.nsfw&&
    !/(ticket|staff|admin|moder|denuncia|suporte|atendimento|logs?)/i.test(c.name||'')&&
    c.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel));
}
function makeTurn(message){
  const clean=String(message.content||'').replace(/<@!?(\d+)>/g,(_,id)=>{
    const u=message.mentions?.users?.get?.(id);
    return '@'+(u?.globalName||u?.username||'membro');
  }).replace(/https?:\/\/\S+/gi,'[link]').replace(/@everyone|@here/gi,'@grupo')
    .replace(/\s+/g,' ').trim().slice(0,320);
  return {id:message.id,authorId:message.author.id,
    speaker:String(message.member?.displayName||message.author.globalName||message.author.username).slice(0,36),
    channelId:message.channelId,channel:String(message.channel?.name||'geral').slice(0,36),
    text:clean,timestamp:message.createdTimestamp||Date.now()};
}
function addRecent(message){
  if(!publicChannel(message)||!message.content?.trim())return false;
  serverRecent.push(makeTurn(message));
  const cutoff=Date.now()-CHAT_AGE;
  while(serverRecent.length>100||serverRecent[0]?.timestamp<cutoff)serverRecent.shift();
  return true;
}
function currentServerContext(currentMessageId){
  const since=Date.now()-CHAT_AGE;
  const unique=new Map();
  for(const m of [...sharedTurns,...serverRecent]){
    if(m?.id&&m.id!==currentMessageId&&m.timestamp>=since&&m.text)
      unique.set(m.id,m);
  }
  return [...unique.values()].sort((a,b)=>a.timestamp-b.timestamp)
    .slice(-26).map(m=>'[#'+m.channel+'] '+m.speaker+': '+m.text)
    .join('\n').slice(-6500);
}
function commitSharedChange(transform){
  sharedWrite=sharedWrite.catch(()=>{}).then(async()=>{
    await sharedReady;
    sharedTurns=transform(sharedTurns).slice(-80);
    await store.saveSharedContext(sharedTurns);
  });
  return sharedWrite;
}
async function saveSharedExchange(message,reply){
  if(!publicChannel(message))return;
  const user=makeTurn(message);
  const answer={...user,id:reply.id,authorId:client.user.id,speaker:'Duckzinha',
    text:reply.content?.slice(0,320)||'',timestamp:reply.createdTimestamp||Date.now()};
  await commitSharedChange(list=>[...list,user,answer]);
}
async function clearSharedUser(userId){
  for(let i=serverRecent.length-1;i>=0;i--)
    if(serverRecent[i].authorId===userId)serverRecent.splice(i,1);
  await commitSharedChange(items=>items.filter(m=>m.authorId!==userId));
}
async function clearSharedAll(){
  serverRecent.length=0;
  await commitSharedChange(()=>[]);
}
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
async function getChannelConversation(message){
  // Consultar o chat só quando Duckzinha for mencionada.
  // Não coletar DMs, canais privados ou mensagens de outros servidores.
  const guild=message.guild;
  const permissions=message.channel?.permissionsFor?.(guild?.roles?.everyone);
  if(!permissions?.has(PermissionFlagsBits.ViewChannel))return '';
  if(!message.channel?.messages?.fetch)return '';
  let timeoutId;
  try{
    const timeout=new Promise((_,reject)=>{
      timeoutId=setTimeout(()=>reject(new Error('tempo limite da leitura do canal')),4500);
    });
    const recent=await Promise.race([
      message.channel.messages.fetch({limit:25,before:message.id}),
      timeout
    ]);
    return formatChannelContext([...recent.values()],client.user?.id);
  }catch(err){
    console.warn('[Duckzinha] Contexto do canal indisponível: '+err.message);
    return '';
  }finally{
    clearTimeout(timeoutId);
  }
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
  if(!client.user)return;
  const id=message.author.id;
  const pending=pendingResearch.get(id);
  if(pending&&Date.now()-pending.at>10*60_000)pendingResearch.delete(id);
  const mentioned=message.mentions.users.has(client.user.id)&&
    (message.content.includes('<@'+client.user.id+'>')||message.content.includes('<@!'+client.user.id+'>'));
  const said=decision(stripMentions(message.content,client.user.id));
  const confirmation=Boolean(pending&&said&&message.channelId===pending.channelId&&
    Date.now()-pending.at<10*60_000&&
    (mentioned||message.reference?.messageId===pending.promptId||
      Date.now()-pending.at<90_000));
  if(!mentioned&&!confirmation)return;
  const previous=busy.get(id);
  if(previous&&Date.now()-previous<60000)return;
  if(previous)console.warn('[Duckzinha] Liberando atendimento antigo preso há mais de 60s.');
  if(!confirmation&&Date.now()-(cooldown.get(id)||0)<7500)return;
  if(confirmation)pendingResearch.delete(id);
  const question=confirmation?pending.question:stripMentions(message.content,client.user.id);
  if(confirmation&&said==='no'){
    const sent=await message.reply({content:'Tá bom! 💛 Se mudar de ideia, é só me chamar.',allowedMentions:{repliedUser:false,parse:[]}}).catch(()=>null);
    if(sent)void schedule(sent).catch(()=>{});
    return;
  }
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
    const [member,facts,personality,channelContext]=await Promise.all([
      store.getMember(id).catch(err=>{console.warn('[Duckzinha] Nome: '+err.message);return null}),
      communityKnowledge(),
      getPersonality(),
      getChannelConversation(message)
    ]);
    // Se o histórico coletivo não estiver disponível, usa o histórico pessoal
    // como alternativa, sem misturar os dois contextos.
    const history=channelContext?[]:await getHistory(id);
    const newName=pickName(question);
    if(newName&&newName!==member?.preferred_name)
      void store.rememberName(id,newName).catch(err=>console.warn('[Duckzinha] Salvar nome: '+err.message));
    const latestName=newName||member?.preferred_name||'';
    let answer=null,aiAnswered=false;
    const searching=confirmation||wantsWebResearch(question);
    let webFacts=null,searchError=null;
    if(searching){
      try{webFacts=await broadWebSearch(researchTopic(question)||question,TAVILY_KEY,SERPER_KEY);
        if(webFacts.provider)console.log('[Duckzinha] Pesquisa via '+webFacts.provider+'.')}
      catch(err){searchError=err;console.warn('[Duckzinha] Pesquisa web: '+err.message)}
    }
    const modelReady=Boolean(CF_ACCOUNT&&CF_TOKEN);
    if(modelReady&&(!searching||webFacts?.status==='ok')){
      try{
        answer=await askCloudflare({accountId:CF_ACCOUNT,token:CF_TOKEN,model:CF_MODEL,
          question,history:channelContext?[]:history,channelContext,
          speaker:message.member?.displayName||message.author.globalName||message.author.username,
          customPersonality:personality,knowledge:Object.entries(facts).map(([k,v])=>k+': '+v).join('\n'),name:latestName,
          research:webFacts?.status==='ok'?webResearchContext(webFacts.results):''});
        aiAnswered=Boolean(answer);
      }catch(e){console.warn('[Duckzinha] IA temporariamente indisponível ('+e.message+'); usando resposta básica.')}
    }
    if(searching&&searchError)answer='A pesquisa na web falhou agora. Pode tentar de novo mais tarde?';
    else if(searching&&webFacts?.status==='not_configured')
      answer='A pesquisa web ainda não está configurada. Configure TAVILY_API_KEY e/ou SERPER_API_KEY na hospedagem.';
    else if(searching&&webFacts?.status!=='ok')
      answer='Procurei na web, mas não encontrei resultados suficientes para confirmar isso.';
    else if(searching&&webFacts?.status==='ok'){
      // A pesquisa realmente ocorreu. Algumas IAs repetem mensagens antigas
      // sobre chaves não configuradas mesmo recebendo resultados da web.
      if(answerIgnoresWebResults(answer)){
        console.warn('[Duckzinha] IA ignorou a pesquisa concluída; usando resumos das fontes.');
        answer=null;
      }
      if(!answer)answer='Encontrei estas informações nas páginas consultadas: '+
        webFacts.results.slice(0,2).map(item=>item.title+': '+item.summary).join(' ');
    }
    answer=safeResponse(answer||cannedAnswer(question,facts))||'Pode explicar um pouquinho melhor?';
    if(/\b(quem sou eu|lembra de mim|qual meu nome)\b/i.test(question))answer=latestName?'Clarooo! Você me contou que gosta de ser chamado de **'+latestName+'**! 🦆💛':'Aii, ainda não sei seu nome! 💛 Pode se apresentar quando me mencionar, se quiser!';
    if(newName&&!/\b(quem sou|meu nome)\b/i.test(question))answer='Aaa, prazer, '+newName+'! 💛 '+answer;
    answer=helpWithTicket(question,answer);
    if(searching&&webFacts?.status==='ok')
      answer=answer.slice(0,1250)+'\n\nFontes: '+researchCitations(webFacts.results);
    const shouldOffer=(!searching&&aiAnswered&&uncertainty(answer));
    if(shouldOffer)answer='Ainda não tenho certeza sobre isso. Quer que eu pesquise mais a fundo na internet? Responda **sim** ou **não**. 💛';
    const sent=await message.reply({content:answer.slice(0,1900),allowedMentions:{repliedUser:false,parse:[]}}).catch(err=>{console.warn('[Duckzinha] Falha na resposta: '+err.message);return null});
    if(sent){
      if(shouldOffer)pendingResearch.set(id,{question,channelId:message.channelId,promptId:sent.id,at:Date.now()});
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
