import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,EmbedBuilder,MessageFlags,PermissionFlagsBits} from 'discord.js';
import {parseTimeSpan,summarizePublicMessages} from './duck-smart.mjs';
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
export const SUGGESTIONS_CHANNEL_ID='1564105832306708631';
const clean=(s,n=400)=>String(s||'').trim().replace(/@everyone|@here/gi,'@grupo').slice(0,n);
const admin=i=>Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
const ts=x=>'<t:'+Math.floor(Date.parse(x)/1000)+':F>';
function visible(c){
 const r=c?.guild?.roles?.everyone;
 return Boolean(c?.type===ChannelType.GuildText&&r&&
   c.permissionsFor?.(r)?.has(PermissionFlagsBits.ViewChannel)&&!c.nsfw&&
   !/(ticket|staff|admin|modera|suporte|atendimento|denuncia|logs?)/i.test(c.name||''));
}
export function parseBahiaDate(text,now=Date.now()){
 const m=/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(String(text||'').trim());
 if(!m)return null;
 const [year,month,day,hour,minute]=m.slice(1).map(Number);
 if(month<1||month>12||day<1||day>31||hour>23||minute>59)return null;
 const ms=Date.parse(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':00-03:00');
 if(!Number.isFinite(ms)||ms<=now+60000||ms>now+366*86400000)return null;
 const d=new Date(ms-3*3600000);
 if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
 return new Date(ms).toISOString();
}
export function suggestionButtons(id){
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('duckidea:vote:'+id).setLabel('Apoiar')
   .setEmoji('💡').setStyle(ButtonStyle.Success))];
}
// Embed nativo do Discord (visual estilo webhook): barra lateral, campos e votos.
export function suggestionEmbed({id,text,authorId,status='open',supporters=[],count=0,createdAt}={}){
 const stages={
  open:{label:'🟡 Em votação',color:0xF4C542},
  approved:{label:'✅ Aprovada',color:0x57D6A0},
  rejected:{label:'❌ Recusada',color:0xE57474},
  cancelled:{label:'⚪ Encerrada',color:0x9299A5}
 };
 const stage=stages[status]||stages.open;
 const validId=id!=null?String(id):'?';
 const validAuthor=/^[0-9]{15,25}$/.test(String(authorId||''));
 const names=[...new Set((supporters||[]).map(String).filter(x=>/^[0-9]{15,25}$/.test(x)))];
 const shown=names.slice(0,20).map(x=>'<@'+x+'>').join(' • ');
 const remaining=Math.max(0,(Number(count)||0)-names.slice(0,20).length);
 const everyone=shown+(remaining?'\n**+ '+remaining+' outros apoiadores**':'');
 const embed=new EmbedBuilder()
  .setColor(stage.color)
  .setTitle('💡 Sugestão #'+validId)
  .setDescription('**📝 Ideia da comunidade**\n'+clean(text,400)+'\n\n'+stage.label)
  .addFields(
   {name:'👤 Enviada por',value:validAuthor?'<@'+authorId+'>':'Membro da comunidade',inline:true},
   {name:'💛 Apoios',value:'**'+Math.max(0,Number(count)||0)+'**',inline:true},
   {name:'🦆 Pessoas que apoiaram',value:everyone||'*Seja o primeiro a apoiar!*',inline:false}
  )
  .setFooter({text:status==='open'
   ?'DuckzinCommunity • Clique em Apoiar para apoiar esta ideia'
   :'DuckzinCommunity • Votação encerrada'});
 const date=Date.parse(String(createdAt||''));
 if(Number.isFinite(date))embed.setTimestamp(new Date(date));
 return embed;
}

export function eventButtons(id){
 return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('duckevent:join:'+id).setLabel('Vou participar')
   .setEmoji('✅').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('duckevent:leave:'+id).setLabel('Sair')
   .setStyle(ButtonStyle.Secondary))];
}
export class DuckCommunityPlus{
 constructor({store,client,now=Date.now}={}){this.store=store;this.client=client;this.now=now;this.timer=null;this.polling=false;}
 async db(query){
  if(!this.store?.persistent)throw Error('Supabase não configurado; aplique sql/duck-community-plus.sql.');
  return this.store.requireResult(query);
 }
 table(n){return this.store.db.from(n);}
 async reminder(interaction){
  const sub=interaction.options.getSubcommand(),uid=interaction.user.id,gid=interaction.guildId;
  try{
   if(sub==='criar'){
    const text=clean(interaction.options.getString('texto',true),180);
    const ms=parseTimeSpan(interaction.options.getString('em',true));
    if(!text||!ms)return interaction.reply(hidden('⏰ Informe texto e duração como 10m, 2h ou 1d (máximo 30 dias).'));
    const when=new Date(this.now()+ms).toISOString();
    await this.db(this.table('duckzinha_reminders').insert({
     guild_id:gid,user_id:uid,text,due_at:when,status:'pending'}));
    return interaction.reply(hidden('⏰ Lembrete salvo! Vou tentar mandar uma DM '+ts(when)+
     '. Mantenha mensagens privadas habilitadas.'));
   }
   if(sub==='listar'){
    const list=await this.db(this.table('duckzinha_reminders').select('id,text,due_at')
     .eq('guild_id',gid).eq('user_id',uid).eq('status','pending')
     .order('due_at',{ascending:true}).limit(10));
    return interaction.reply(hidden(list.length?'⏰ Seus lembretes:\n'+
     list.map(x=>'#'+x.id+' • '+ts(x.due_at)+' • '+x.text.slice(0,65)).join('\n'):
     'Você não tem lembretes pendentes.'));
   }
   const id=interaction.options.getInteger('id',true);
   const row=await this.db(this.table('duckzinha_reminders').update({status:'cancelled'})
    .eq('id',id).eq('guild_id',gid).eq('user_id',uid).eq('status','pending')
    .select('id').maybeSingle());
   return interaction.reply(hidden(row?'✅ Lembrete cancelado.':'Lembrete não encontrado.'));
  }catch{return interaction.reply(hidden('⚠️ Não consegui consultar o banco. Confira a migração SQL.'));}
 }
 async naturalReminder(message,reminder){
  const at=Date.parse(reminder.at),text=clean(reminder.text,180);
  if(!text||at<this.now()+60000||at>this.now()+30*86400000)return false;
  try{
   await this.db(this.table('duckzinha_reminders').insert({
    guild_id:message.guildId,user_id:message.author.id,text,due_at:reminder.at,status:'pending'}));
   await message.reply({content:'⏰ Anotei! Vou tentar mandar uma DM '+ts(reminder.at)+
    ' lembrando: '+text,allowedMentions:{parse:[],repliedUser:false}});
  }catch{
   await message.reply({content:'⚠️ Não consegui salvar o lembrete. Confira o Supabase.',
    allowedMentions:{parse:[],repliedUser:false}});
  }
  return true;
 }
 async summary(interaction){
  if(!visible(interaction.channel))return interaction.reply(hidden(
    'Só resumo mensagens recentes deste canal público, nunca canais privados ou tickets.'));
  await interaction.deferReply();
  try{
   const recent=await interaction.channel.messages.fetch({limit:100});
   return interaction.editReply({content:summarizePublicMessages([...recent.values()],
    {now:this.now()}).slice(0,1900),allowedMentions:{parse:[]}});
  }catch{return interaction.editReply('Não consegui ler o histórico deste canal.');}
 }
 async suggestionVotes(id){
  if(!this.store?.persistent)throw Error('Supabase não configurado.');
  // Um único SELECT retorna contagem exata e os 20 primeiros apoiadores,
  // sem precisar carregar milhares de perfis para o Discord.
  let timer;
  try{
   const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('Consulta de apoiadores demorou demais')),8000);
    timer.unref?.();
   });
   const result=await Promise.race([
    this.table('duckzinha_suggestion_votes')
     .select('user_id',{count:'exact'})
     .eq('suggestion_id',id).order('created_at',{ascending:true}).limit(20),
    timeout
   ]);
   if(result?.error)throw Error('Apoiadores: '+result.error.message);
   return {count:result?.count??(result?.data||[]).length,
    supporters:(result?.data||[]).map(x=>x.user_id)};
  }finally{if(timer)clearTimeout(timer);}
 }
 async suggest(interaction){
  if(interaction.channelId!==SUGGESTIONS_CHANNEL_ID)
   return interaction.reply(hidden('💡 Use /sugerir somente no canal <#'+SUGGESTIONS_CHANNEL_ID+'>.'));
  if(!visible(interaction.channel))return interaction.reply(hidden('Sugestões precisam ser publicadas num canal público.'));
  const idea=clean(interaction.options.getString('ideia',true));
  if(idea.length<8)return interaction.reply(hidden('Descreva melhor sua sugestão.'));
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  try{
   const data=await this.db(this.table('duckzinha_suggestions').insert({
    guild_id:interaction.guildId,author_id:interaction.user.id,channel_id:interaction.channelId,
    text:idea,status:'open'
   }).select('id').single());
   const msg=await interaction.channel.send({
    embeds:[suggestionEmbed({id:data.id,text:idea,authorId:interaction.user.id,
     count:0,supporters:[],createdAt:new Date(this.now()).toISOString()})],
    components:suggestionButtons(data.id),allowedMentions:{parse:[]}});
   await this.db(this.table('duckzinha_suggestions').update({message_id:msg.id})
    .eq('guild_id',interaction.guildId).eq('id',data.id));
   return interaction.editReply('✅ Sua sugestão foi publicada!');
  }catch{return interaction.editReply('⚠️ Não consegui publicar. Confira minhas permissões e o SQL.');}
 }
 async suggestionAdmin(interaction){
  if(!admin(interaction))return interaction.reply(hidden('Só administradores podem decidir sugestões.'));
  const id=interaction.options.getInteger('id',true),
    status=interaction.options.getSubcommand()==='aprovar'?'approved':'rejected';
  try{
   const row=await this.db(this.table('duckzinha_suggestions').update({status})
    .eq('id',id).eq('guild_id',interaction.guildId).eq('status','open')
    .select('id,text,author_id,created_at,channel_id,message_id,status').maybeSingle());
   if(!row)return interaction.reply(hidden('Sugestão não encontrada ou já avaliada.'));
   const c=await interaction.guild.channels.fetch(row.channel_id).catch(()=>null);
   const m=await c?.messages?.fetch(row.message_id).catch(()=>null);
   if(m){
    const votes=await this.suggestionVotes(id);
    await m.edit({content:'',embeds:[suggestionEmbed({id,text:row.text,authorId:row.author_id,
     status,supporters:votes.supporters,count:votes.count,createdAt:row.created_at})],
     components:[],allowedMentions:{parse:[]}}).catch(error=>
      console.warn('[Duckzinha] Atualizar sugestão encerrada: '+String(error?.message||error)));
   }
   return interaction.reply(hidden('✅ Sugestão #'+id+' avaliada.'));
  }catch{return interaction.reply(hidden('Falha ao avaliar sugestão.'));}
 }
 async suggestionButton(interaction){
  const id=Number(interaction.customId.split(':')[2]);
  if(!Number.isSafeInteger(id)||id<1)return interaction.reply(hidden('Sugestão inválida.'));
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  try{
   const item=await this.db(this.table('duckzinha_suggestions')
    .select('status,author_id,text,created_at,channel_id,message_id')
    .eq('guild_id',interaction.guildId).eq('id',id).maybeSingle());
   if(item?.status!=='open')return interaction.editReply('Essa votação já foi encerrada.');
   await this.db(this.table('duckzinha_suggestion_votes').upsert({
    suggestion_id:id,user_id:interaction.user.id
   },{onConflict:'suggestion_id,user_id',ignoreDuplicates:true}));
   const votes=await this.suggestionVotes(id);
   const embed=suggestionEmbed({id,text:item.text,authorId:item.author_id,
    createdAt:item.created_at,count:votes.count,supporters:votes.supporters});
   // Atualiza a publicação original, sem mandar mensagens extras no canal.
   const message=interaction.message?.id===item.message_id?interaction.message:
    await interaction.guild?.channels?.fetch(item.channel_id).then(c=>
      c?.messages?.fetch(item.message_id)).catch(()=>null);
   if(!message?.edit)return interaction.editReply(
    '💛 Apoio salvo, mas não consegui encontrar a mensagem para atualizar a lista.');
   await message.edit({content:'',embeds:[embed],components:suggestionButtons(id),
    allowedMentions:{parse:[]}});
   return interaction.editReply('💛 Seu apoio está registrado! A lista foi atualizada.');
  }catch(error){
   console.warn('[Duckzinha] Apoiar sugestão: '+String(error?.message||error));
   return interaction.editReply('Não consegui atualizar os apoios agora. Tente novamente.');
  }
 }
 async event(interaction){
  const sub=interaction.options.getSubcommand(),gid=interaction.guildId;
  try{
   if(sub==='listar'){
    const list=await this.db(this.table('duckzinha_events').select('id,title,starts_at')
     .eq('guild_id',gid).eq('status','open').gte('starts_at',new Date(this.now()).toISOString())
     .order('starts_at',{ascending:true}).limit(10));
    return interaction.reply(hidden(list.length?'🎉 Próximos eventos:\n'+
      list.map(x=>'#'+x.id+' • '+x.title+' • '+ts(x.starts_at)).join('\n'):'Sem eventos agendados.'));
   }
   if(!admin(interaction))return interaction.reply(hidden('Só administradores podem criar/cancelar eventos.'));
   if(sub==='cancelar'){
    const id=interaction.options.getInteger('id',true);
    const row=await this.db(this.table('duckzinha_events').update({status:'cancelled'})
     .eq('guild_id',gid).eq('id',id).eq('status','open')
     .select('title,channel_id,message_id').maybeSingle());
    if(!row)return interaction.reply(hidden('Evento não encontrado.'));
    const c=await interaction.guild.channels.fetch(row.channel_id).catch(()=>null);
    const m=await c?.messages?.fetch(row.message_id).catch(()=>null);
    await m?.edit({content:'❌ Evento cancelado: '+clean(row.title,90),
     components:[],allowedMentions:{parse:[]}}).catch(()=>{});
    return interaction.reply(hidden('✅ Evento cancelado.'));
   }
   if(!visible(interaction.channel))return interaction.reply(hidden('Publique eventos em canais públicos.'));
   const title=clean(interaction.options.getString('titulo',true),90),
    description=clean(interaction.options.getString('descricao')),
    when=parseBahiaDate(interaction.options.getString('quando',true),this.now());
   if(title.length<3||!when)return interaction.reply(hidden(
    'Informe AAAA-MM-DD HH:MM (horário da Bahia) no futuro.'));
   await interaction.deferReply({flags:MessageFlags.Ephemeral});
   const entry=await this.db(this.table('duckzinha_events').insert({
    guild_id:gid,creator_id:interaction.user.id,channel_id:interaction.channelId,
    title,description,starts_at:when,status:'open'
   }).select('id').single());
   const post=await interaction.channel.send({content:'## 🎉 '+title+'\n'+description+
    '\n\n📅 '+ts(when)+'\nClique abaixo para participar!',
    components:eventButtons(entry.id),allowedMentions:{parse:[]}});
   await this.db(this.table('duckzinha_events').update({message_id:post.id})
    .eq('id',entry.id).eq('guild_id',gid));
   return interaction.editReply('✅ Evento publicado! Avisarei neste canal quando começar.');
  }catch{
   if(interaction.deferred)return interaction.editReply('⚠️ Não consegui publicar o evento. Confira o SQL.');
   return interaction.reply(hidden('⚠️ Não consegui concluir o comando. Confira o SQL.'));
  }
 }
 async eventButton(interaction){
  const [,verb,rawId]=interaction.customId.split(':'),id=Number(rawId);
  if(!Number.isSafeInteger(id)||!['join','leave'].includes(verb))
   return interaction.reply(hidden('Evento inválido.'));
  try{
   const row=await this.db(this.table('duckzinha_events').select('status,starts_at')
    .eq('id',id).eq('guild_id',interaction.guildId).maybeSingle());
   if(row?.status!=='open'||Date.parse(row.starts_at)<=this.now())
    return interaction.reply(hidden('Inscrições encerradas.'));
   if(verb==='join'){
    await this.db(this.table('duckzinha_event_attendees').upsert({
     event_id:id,user_id:interaction.user.id
    },{onConflict:'event_id,user_id',ignoreDuplicates:true}));
    return interaction.reply(hidden('🎉 Você está na lista!'));
   }
   await this.db(this.table('duckzinha_event_attendees').delete()
    .eq('event_id',id).eq('user_id',interaction.user.id));
   return interaction.reply(hidden('✅ Participação cancelada.'));
  }catch{return interaction.reply(hidden('Não consegui registrar sua participação.'));}
 }
 start(){
  if(this.timer)return;
  void this.tick();
  this.timer=setInterval(()=>{void this.tick()},60000);
  this.timer.unref?.();
 }
 shutdown(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 async tick(){
  if(this.polling||!this.store?.persistent)return;
  this.polling=true;
  const gid=this.store.guildId,now=new Date(this.now()).toISOString();
  try{
   const reminders=await this.db(this.table('duckzinha_reminders').select('id,user_id,text')
    .eq('guild_id',gid).eq('status','pending').lte('due_at',now).limit(15));
   for(const x of reminders){
    const picked=await this.db(this.table('duckzinha_reminders').update({status:'sent'})
     .eq('id',x.id).eq('guild_id',gid).eq('status','pending').select('id').maybeSingle());
    if(!picked)continue;
    try{
     const user=await this.client.users.fetch(x.user_id);
     await user.send({content:'⏰ **Lembrete Duckzinha** 🦆\n'+clean(x.text,180),
      allowedMentions:{parse:[]}});
    }catch(error){
     console.warn('[Duckzinha] DM de lembrete: '+String(error?.message||error));
     await this.db(this.table('duckzinha_reminders').update({status:'failed'})
      .eq('id',x.id).eq('guild_id',gid)).catch(()=>{});
    }
   }
   const events=await this.db(this.table('duckzinha_events').select('id,title,channel_id')
    .eq('guild_id',gid).eq('status','open').is('announced_at',null)
    .lte('starts_at',now).limit(10));
   for(const x of events){
    const claimed=await this.db(this.table('duckzinha_events')
     .update({announced_at:now,status:'finished'}).eq('guild_id',gid)
     .eq('id',x.id).eq('status','open').is('announced_at',null)
     .select('id').maybeSingle());
    if(!claimed)continue;
    const channel=await this.client.channels.fetch(x.channel_id).catch(()=>null);
    await channel?.send({content:'🎉 **O evento começou!**\n'+clean(x.title,90),
     allowedMentions:{parse:[]}}).catch(e=>
      console.warn('[Duckzinha] Aviso de evento: '+String(e?.message||e)));
   }
  }catch(e){console.warn('[Duckzinha] Agendamentos: '+String(e?.message||e));}
  finally{this.polling=false;}
 }
}
