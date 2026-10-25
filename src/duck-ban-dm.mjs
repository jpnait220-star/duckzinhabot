import {AuditLogEvent,PermissionFlagsBits} from 'discord.js';
const safe=value=>String(value??'').replace(/[\r\n\t]+/g,' ')
  .replace(/[@*_~<>\\]/g,'').replace(/\s+/g,' ').trim();
const validId=value=>/^\d{17,22}$/.test(String(value||''));
export function banDmText({guildName,moderator,reason}={}){
 const server=safe(guildName).slice(0,80)||'servidor';
 const staff=safe(moderator).slice(0,70)||'equipe de moderação';
 const why=safe(reason).slice(0,350)||'Motivo não informado.';
 return '🔨 **Aviso de banimento • '+server+'**\n\n'+
  'Olá! Estou passando para avisar que você foi **banido(a)** do servidor **'+server+'**.\n\n'+
  '🛡️ **Quem aplicou:** '+staff+'\n'+
  '📝 **Motivo:** '+why+'\n\n'+
  'Poxa, que pena que terminou assim. 💛 Espero que isso sirva de aprendizado para respeitar as regras e conviver melhor com todo mundo.\n'+
  'Se achar que houve algum engano, você pode procurar a equipe de moderação pelos canais oficiais.';
}
export class DuckBanNotifier{
 constructor({now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),logger=console}={}){
  Object.assign(this,{now,wait,logger});this.recent=new Map();
 }
 key(guildId,userId){return guildId+':'+userId;}
 reserve(guildId,userId){
  const key=this.key(guildId,userId);
  for(const [k,v] of this.recent)if(this.now()-v>120000)this.recent.delete(k);
  if(this.recent.has(key))return false;
  this.recent.set(key,this.now());
  return true;
 }
 release(guildId,userId){this.recent.delete(this.key(guildId,userId));}
 async send(user,{guildName,moderator,reason}={}){
  if(!user||typeof user.send!=='function')return {ok:false,reason:'no-user'};
  try{
   await user.send({content:banDmText({guildName,moderator,reason}),
    allowedMentions:{parse:[]}});
   return {ok:true};
  }catch(error){
   // DMs podem estar bloqueadas pelas preferências da pessoa.
   this.logger.warn('[Duckzinha] Não foi possível enviar DM de banimento: '+String(error?.message||error).slice(0,180));
   return {ok:false,reason:'dm-closed'};
  }
 }
 async botBanCompleted({guild,user,moderator,reason}){
  return this.send(user,{guildName:guild?.name,moderator,reason});
 }
 async onBanEvent(ban,{botId}={}){
  const guild=ban?.guild,user=ban?.user;
  if(!guild||!validId(user?.id)||!this.reserve(guild.id,user.id))
   return {ok:false,reason:'duplicate'};
  // Não atribuir a punição à pessoa errada: o audit log precisa coincidir
  // com o usuário banido e ter sido criado há poucos segundos.
  let moderator='',reason='';
  try{
   const me=guild.members?.me||await guild.members?.fetchMe?.().catch(()=>null);
   if(me?.permissions?.has(PermissionFlagsBits.ViewAuditLog)){
    await this.wait(700);
    const logs=await guild.fetchAuditLogs({type:AuditLogEvent.MemberBanAdd,limit:8});
    const entry=[...(logs?.entries?.values?.()||[])].find(e=>
     String(e.target?.id)===String(user.id)&&
     Math.abs(this.now()-(e.createdTimestamp||0))<30000);
    if(entry){
     moderator=entry.executor?.username||'';
     reason=entry.reason||'';
     if(botId&&entry.executor?.id===botId)moderator='Duckzinha (moderação)';
    }
   }
  }catch(error){
   this.logger.warn('[Duckzinha] Sem acesso ao registro de banimento: '+String(error?.message||error).slice(0,180));
  }
  return this.send(user,{
   guildName:guild.name,
   moderator:moderator||'equipe de moderação',
   reason:reason||'Motivo não informado.'
  });
 }
}
