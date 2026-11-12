import {publicMessageText,publicMessageSpeaker} from './duck-channel-context.mjs';
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const safeName=value=>String(value||'essa pessoa').replace(/[@\r\n]/g,'').replace(/[\\`*_~|<>\[\]]/g,'\\$&').trim().slice(0,45)||'essa pessoa';

function cachedMessage(turn){
 return {id:turn.id,channelId:turn.channelId,guildId:turn.guildId,createdTimestamp:turn.timestamp,
  content:turn.text,author:{id:turn.authorId,username:turn.username||turn.speaker,globalName:turn.globalName,bot:Boolean(turn.bot)},
  member:{displayName:turn.displayName||turn.speaker}};
}
function scoped(messages,message,{limit,now}){
 const cutoff=now-4*60*60_000,before=Number(message.createdTimestamp)||now;
 const unique=new Map();
 for(const item of messages){
  const at=Number(item?.createdTimestamp);
  if(!item?.id||item.id===message.id||!item.author||!Number.isFinite(at)||at<cutoff||at>before)continue;
  if(item.channelId&&item.channelId!==message.channelId)continue;
  if(item.guildId&&message.guildId&&item.guildId!==message.guildId)continue;
  unique.set(item.id,item);
 }
 return [...unique.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp).slice(-limit);
}

/** Read only the current public channel. A successful API read is authoritative, including deletions. */
export async function readPublicChannel(message,{allowed=false,turns=[],limit=50,timeoutMs=5000,now=Date.now(),onIssue=()=>{}}={}){
 if(!allowed)return [];
 limit=Math.min(100,Math.max(1,Number(limit)||50));
 const fallback=()=>scoped(turns.filter(t=>t.channelId===message.channelId).map(cachedMessage),message,{limit,now});
 if(!message.channel?.messages?.fetch)return fallback();
 let timer;
 try{
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('tempo limite da leitura do canal')),timeoutMs);});
  const records=await Promise.race([message.channel.messages.fetch({limit,before:message.id}),timeout]);
  const messages=scoped([...records.values()],message,{limit,now});
  if(messages.length&&!messages.some(m=>publicMessageText(m)))onIssue('Mensagens recebidas sem texto. Confira Message Content Intent no Discord Developer Portal.');
  return messages;
 }catch(error){
  const permission=[50001,50013].includes(Number(error?.code));
  onIssue(permission?'Sem acesso ao histórico: confira Ver canal e Ler histórico de mensagens. Usando apenas o cache público deste canal.':'Histórico temporariamente indisponível; usando apenas o cache público deste canal.');
  return fallback();
 }finally{if(timer)clearTimeout(timer);}
}

/** Narrow, literal chat lookup; no model, external search or generated attribution. */
export function replyFromChannel(question,messages=[],{botId='',requesterId='',referenceId=''}={}){
 const raw=String(question||'').replace(/<@!?(\d+)>/g,(value,id)=>id===botId?' ':value).trim();
 const q=normal(raw).replace(/[?!.,]+$/g,'').trim();
 const match=q.match(/^(?:e\s+)?(?:o\s*que|oq|oque|o\s*q|que)\s+(?:o\s+|a\s+)?(.+?)\s+(?:falou|falei|disse|mandou|mandei|escreveu|escrevi|comentou|comentei|respondeu|respondi)(?:\s+(?:agora|aqui|no chat|por ultimo))?$/);
 if(!match)return null;
 const target=match[1].replace(/^@/,'').trim();
 const mention=target.match(/^<@!?(\d+)>$/);
 let id=mention?.[1];
 if(['eu','mim'].includes(target))id=requesterId;
 if(['ele','ela','essa pessoa','esse cara'].includes(target)){
  id=messages.find(m=>m.id===referenceId)?.author?.id;
  if(!id)return 'De quem você está falando? Marque a pessoa ou responda à mensagem dela para eu conferir o que escreveu.';
 }
 if(!id){
  const ids=new Set(messages.filter(m=>[m.author?.username,m.author?.globalName,m.member?.displayName].some(name=>normal(name)===target)).map(m=>m.author.id));
  if(ids.size>1)return 'Encontrei mais de uma pessoa com esse nome no histórico. Marque quem você quer consultar para eu não confundir as falas.';
  id=[...ids][0];
 }
 const found=messages.filter(m=>id&&m.author?.id===id&&publicMessageText(m)).sort((a,b)=>a.createdTimestamp-b.createdTimestamp).at(-1);
 if(!found)return 'Não encontrei uma mensagem recente '+(mention?'dessa pessoa':'de **'+safeName(match[1])+'**')+' nas mensagens disponíveis deste canal. Pode responder à mensagem que você quer que eu confira?';
 return '**'+safeName(publicMessageSpeaker(found,botId))+'** disse:\n> '+publicMessageText(found,{max:700});
}
