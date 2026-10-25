import {PermissionFlagsBits} from 'discord.js';
import {sendModerationLog} from './duck-moderation-log.mjs';

const ADMIN=PermissionFlagsBits.Administrator;
const BAN=PermissionFlagsBits.BanMembers;
const TIMEOUT=PermissionFlagsBits.ModerateMembers;
const MAX_TIMEOUT=28*24*60*60*1000;
const SNOWFLAKE=/^\d{17,22}$/;

// Apenas ordens diretas. Nunca deixa a IA escolher a pessoa ou decidir punições.
export function parseModerationRequest(content,botId){
  if(!SNOWFLAKE.test(String(botId||'')))return null;
  const botTag=new RegExp('<@!?'+botId+'>','g');
  const text=String(content||'').replace(botTag,' ').trim();
  const normalized=text.replace(/^duckzinha[,! ]*/i,'')
    .replace(/^por\s+favor[,! ]*/i,'')
    .replace(/^(?:pode|poderia)\s+(?:me\s+)?/i,'').trim();
  const m=/^(desban(?:a|ir|e)?|unban|ban(?:a|e|ir)?|desmut(?:a|ar|e)?|unmute|tir(?:a|ar)\s+(?:o\s+)?castigo|remov(?:a|e|er)\s+(?:o\s+)?castigo|retir(?:a|ar)\s+(?:o\s+)?castigo|castig(?:a|ar|ue)|mut(?:a|ar|e)|mute|silenci(?:a|ar))\b\s*(.*)$/iu.exec(normalized);
  if(!m)return null;
  const verb=m[1].toLowerCase();
  const kind=/^(desban|unban)/.test(verb)?'unban':
    /^ban/.test(verb)?'ban':
    /^(desmut|unmute|tir|remov|retir)/.test(verb)?'untimeout':'timeout';
  return {kind,tail:m[2].trim()};
}
function normalizeName(value){
  return String(value||'').trim().replace(/^["'\u201c\u201d]|["'\u201c\u201d]$/g,'')
    .toLocaleLowerCase('pt-BR');
}
export function parseDuration(text){
  const m=/(?:^|\s)(?:por|durante)?\s*(\d{1,9})\s*(segundos?|segs?|s|minutos?|mins?|min|m|horas?|hrs?|h|dias?|d)\b/iu.exec(String(text||''));
  if(!m)return null;
  const n=Number(m[1]),unit=m[2].toLowerCase();
  const mult=/^(?:s|seg)/.test(unit)?1000:/^(?:m|min)/.test(unit)?60000:/^(?:h|hora)/.test(unit)?3600000:86400000;
  return {ms:n*mult,source:m[0].trim()};
}
function cleanTarget(tail,kind){
  let text=String(tail||'').replace(/^\s*(?:o|a|ao|aos|usu[aá]rio|usu[aá]ria|membro|jogador|jogadora|player)\b\s*/iu,'').trim();
  text=text.split(/\s+(?:por\s+motivo\s+de|motivo\s*[:=]|porque)\s*/iu)[0].trim();
  if(kind==='timeout'){
    text=text.replace(/\s+(?:por|durante)?\s*\d{1,9}\s*(?:segundos?|segs?|s|minutos?|mins?|min|m|horas?|hrs?|h|dias?|d)\b.*$/iu,'');
  }
  return text.trim();
}
function reasonFrom(tail,authorName){
  const m=/(?:^|\s)(?:motivo\s*[:=]|por\s+motivo\s+de|porque)\s+(.+)$/iu.exec(tail);
  const reason=m?.[1]?.trim().slice(0,150)||'Moderação solicitada por administrador';
  return reason+' (por '+String(authorName||'administrador').slice(0,50)+')';
}
function selectExact(matches){
  const found=[...matches];
  return found.length===1?{ok:true,user:found[0]}:
    {ok:false,message:found.length
      ?'Encontrei mais de uma pessoa com esse nome. Mencione o usuário diretamente.'
      :'Não encontrei esse nome exato. Use @menção ou ID do usuário.'};
}
function userMatches(user,query){
  const q=normalizeName(query);
  return [user?.username,user?.globalName,user?.tag,user?.displayName,user?.user?.username,user?.user?.globalName]
    .some(x=>x&&normalizeName(x)===q);
}
function targetMentions(message,botId){
  return [...new Set([...String(message.content||'').matchAll(/<@!?(\d{17,22})>/g)]
    .map(m=>m[1]).filter(id=>id!==botId))];
}
async function resolveMember(message,action,botId){
  const ids=targetMentions(message,botId);
  if(ids.length>1)return {ok:false,message:'Mencione apenas um usuário por comando.'};
  const target=ids[0]||cleanTarget(action.tail,action.kind);
  if(!target)return {ok:false,message:'Informe a pessoa: @Duckzinha castiga @Pessoa por 10 minutos.'};
  if(SNOWFLAKE.test(target)){
    const member=await message.guild.members.fetch(target).catch(()=>null);
    return member?{ok:true,member}:{ok:false,message:'Não encontrei esse usuário no servidor.'};
  }
  if(target.length>64||/[<>@\r\n]/.test(target))
    return {ok:false,message:'Nome inválido. Use uma menção do Discord.'};
  let candidates=[];
  try{
    const collection=await message.guild.members.search({query:target,limit:100});
    candidates=[...collection.values()].filter(m=>userMatches(m,target));
  }catch{/* Mencionar diretamente não exige pesquisa por nome. */}
  if(!candidates.length){
    const cache=message.guild.members.cache;
    if(cache?.values)candidates=[...cache.values()].filter(m=>userMatches(m,target));
  }
  const unique=new Map(candidates.map(m=>[m.id,m]));
  const selected=selectExact(unique.values());
  return selected.ok?{ok:true,member:selected.user}:selected;
}
// Desbana pelo username único do Discord, jamais pelo nome de exibição/apelido.
async function resolveBanned(message,action,botId){
  const ids=targetMentions(message,botId);
  if(ids.length>1)return {ok:false,message:'Indique apenas uma pessoa para desbanir.'};
  let target=ids[0]||cleanTarget(action.tail,action.kind);
  if(!target)return {ok:false,message:'Informe o @username do Discord ou o ID do usuário banido.'};
  if(SNOWFLAKE.test(target)){
    const ban=await message.guild.bans.fetch(target).catch(()=>null);
    return ban?{ok:true,ban}:{ok:false,message:'Esse ID não consta como banido.'};
  }
  // "@nome" digitado é aceito, sem exigir que a pessoa banida esteja no servidor.
  target=target.replace(/^@/,'').trim().toLowerCase();
  if(!/^[a-z0-9_.]{2,32}$/.test(target))
    return {ok:false,message:'Informe o username do Discord (ex.: usuario.legal), não o apelido exibido.'};
  let after;
  const matches=new Map();
  try{
    // API do Discord pagina a lista de bans. Evita usar apelidos ou coincidências parciais.
    for(let page=0;page<20;page++){
      const options=after?{limit:1000,after}:{limit:1000};
      const bans=await message.guild.bans.fetch(options);
      const records=[...bans.values()];
      for(const ban of records){
        if(String(ban.user?.username||'').toLowerCase()===target)
          matches.set(ban.user.id,ban);
      }
      if(records.length<1000)break;
      const lastId=records.at(-1)?.user?.id;
      if(!lastId||lastId===after)break;
      after=lastId;
    }
  }catch(error){
    return {ok:false,message:'Não consegui consultar os bans: '+String(error?.message||error).slice(0,100)};
  }
  const selected=selectExact(matches.values());
  return selected.ok?{ok:true,ban:selected.user}:
    {ok:false,message:matches.size
      ?'Nome ambíguo na lista de banidos; use o ID.'
      :'Não achei o username exato nos bans consultados. Confira o @username (não nome de exibição), ou use o ID.'};
}
export async function handleModerationRequest(message,action,{botId,store,banNotifier}={}){
  const respond=content=>message.reply({content,allowedMentions:{parse:[],repliedUser:false}});
  const niceName=user=>String(user?.username||'usuario').replace(/[@*_~`<>\\]/g,'').slice(0,32);
  const success=async (content,{target,reason,durationMs}={})=>{
    let note='';
    try{
      const log=await sendModerationLog({message,store,action:action.kind,target,reason,durationMs});
      if(!log.ok)note='\n\n⚠️ *A ação funcionou, mas não consegui registrar no canal de logs.*';
    }catch(error){
      console.warn('[Duckzinha] Falha ao enviar modlog: '+String(error?.message||error));
      note='\n\n⚠️ *A ação funcionou, mas não consegui registrar no canal de logs.*';
    }
    return respond(content+note);
  };
  if(!message.inGuild?.()||!message.guild||message.author?.bot)return;
  if(!action||!['ban','unban','timeout','untimeout'].includes(action.kind))return;
  if(!message.member?.permissions?.has(ADMIN))
    return respond('🔒 **Acesso negado.** Apenas administradores podem usar comandos de moderação.');
  const me=message.guild.members.me||await message.guild.members.fetchMe().catch(()=>null);
  const required=(action.kind==='ban'||action.kind==='unban')?BAN:TIMEOUT;
  if(!me?.permissions?.has(required)){
    return respond('⚠️ Preciso da permissão **'+(required===BAN?'Banir Membros':'Moderar Membros')+'**.');
  }
  const resolved=action.kind==='unban'
    ?await resolveBanned(message,action,botId)
    :await resolveMember(message,action,botId);
  if(!resolved.ok)return respond('⚠️ '+resolved.message);
  const target=resolved.member?.user||resolved.ban?.user;
  const id=target?.id;
  if(!id||id===message.author.id||id===botId||id===message.guild.ownerId)
    return respond('⚠️ Não posso aplicar esse comando a essa pessoa.');
  const member=resolved.member;
  if(member?.permissions?.has(ADMIN))return respond('⚠️ Não posso punir outro administrador.');
  const reason=reasonFrom(action.tail,message.author?.username);
  try{
    if(action.kind==='ban'){
      if(member.bannable!==true)
        return respond('⚠️ Não posso banir esse membro. Confira a hierarquia dos cargos.');
      // Reserva antes do ban: GuildBanAdd não pode mandar uma DM duplicada
      // enquanto este fluxo envia a notificação com o nome do administrador.
      banNotifier?.reserve(message.guild.id,id);
      try{await member.ban({reason,deleteMessageSeconds:0});}
      catch(error){banNotifier?.release(message.guild.id,id);throw error;}
      if(banNotifier){
        const explanation=reason.replace(/\s+\(por [^)]+\)$/,'');
        const dm=await banNotifier.botBanCompleted({
          guild:message.guild,user:target,
          moderator:message.author?.username||'administrador',
          reason:explanation
        });
        if(!dm.ok)console.warn('[Duckzinha] Ban aplicado, mas a DM não chegou ao usuário.');
      }
      return success('## 🔨 Membro banido!\n'+
        '🦆 **'+niceName(target)+'** foi de ban, bobão! 👀\n'+
        '✨ Punição aplicada com sucesso.',{target,reason});
    }
    if(action.kind==='unban'){
      await message.guild.bans.remove(id,reason);
      return success('## ✅ Banimento removido!\n'+
        '🦆 **'+niceName(target)+'** pode voltar ao servidor. Nada de bagunça, hein? 😁',
        {target,reason});
    }
    if(member.moderatable!==true)
      return respond('⚠️ Não posso castigar esse membro. Confira a hierarquia dos cargos.');
    if(action.kind==='timeout'){
      const duration=parseDuration(action.tail);
      if(duration&&(!Number.isSafeInteger(duration.ms)||duration.ms<1000||duration.ms>MAX_TIMEOUT))
        return respond('⚠️ O castigo deve durar entre 1 segundo e 28 dias.');
      const ms=duration?.ms||10*60*1000;
      await member.timeout(ms,reason);
      return success('## 🔇 Castigo aplicado!\n'+
        '🦆 **'+niceName(target)+'** foi para o cantinho do pensamento, bobão! 🤭\n'+
        '⏳ **Duração:** '+(duration?.source||'10 minutos')+'.',
        {target,reason,durationMs:ms});
    }
    await member.timeout(null,reason);
    return success('## 🔊 Castigo removido!\n'+
      '🦆 **'+niceName(target)+'** já pode falar novamente. Se comporta! 😊',
      {target,reason});
  }catch(error){
    console.warn('[Duckzinha] Moderação ('+action.kind+'): '+String(error?.message||error));
    return respond('⚠️ Não consegui executar essa ação. Confira permissões e hierarquia dos cargos.');
  }
}
