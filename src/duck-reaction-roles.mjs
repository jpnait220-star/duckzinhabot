import {EmbedBuilder,SlashCommandBuilder,PermissionFlagsBits,ChannelType,MessageFlags,parseEmoji} from 'discord.js';

const unsafe=[PermissionFlagsBits.Administrator,PermissionFlagsBits.ManageGuild,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageWebhooks,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.BanMembers,PermissionFlagsBits.KickMembers,PermissionFlagsBits.ModerateMembers,PermissionFlagsBits.MentionEveryone,PermissionFlagsBits.ViewAuditLog,PermissionFlagsBits.ManageEvents,PermissionFlagsBits.ManageNicknames,PermissionFlagsBits.ManageThreads];
const WEBHOOK_NAME='Duckzinha • Cargos';
export function reactionRoleCommands(){
 const id=s=>s.addStringOption(o=>o.setName('mensagem').setDescription('ID da mensagem do painel').setRequired(true).setMinLength(17).setMaxLength(22));
 const emoji=s=>s.addStringOption(o=>o.setName('emoji').setDescription('Ex.: 🧩 ou <:nome:id>').setRequired(true).setMaxLength(80));
 const role=s=>s.addRoleOption(o=>o.setName('cargo').setDescription('Cargo que será concedido').setRequired(true));
 return [new SlashCommandBuilder().setName('cargosreacao').setDescription('Criar painéis de cargos por reação')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false)
  .addSubcommand(s=>role(emoji(s.setName('criar').setDescription('Publicar painel como a própria Duckzinha')
    .addStringOption(o=>o.setName('titulo').setDescription('Título').setRequired(true).setMaxLength(90))
    .addStringOption(o=>o.setName('descricao').setDescription('Texto do painel').setRequired(true).setMaxLength(700))))
    .addChannelOption(o=>o.setName('canal').setDescription('Canal, se diferente do atual').addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement)))
  .addSubcommand(s=>role(emoji(id(s.setName('adicionar').setDescription('Adicionar emoji e cargo')))))
  .addSubcommand(s=>emoji(id(s.setName('remover').setDescription('Remover uma opção de cargo'))))
  .addSubcommand(s=>id(s.setName('apagar').setDescription('Excluir painel')))
  .addSubcommand(s=>id(s.setName('ver').setDescription('Ver opções cadastradas')))
  .addSubcommand(s=>id(s.setName('editar').setDescription('Editar título ou descrição do painel')
    .addStringOption(o=>o.setName('titulo').setDescription('Novo título (opcional)').setMaxLength(90))
    .addStringOption(o=>o.setName('descricao').setDescription('Nova descrição (opcional)').setMaxLength(700))))
  .addSubcommand(s=>id(s.setName('migrar').setDescription('Trocar painel antigo de webhook por mensagem da Duckzinha')))
  .addSubcommand(s=>s.setName('diagnostico').setDescription('Verificar permissões e banco antes de criar um painel')).toJSON()];
}
export function validReactionRole(role,botMember,guild){
 return Boolean(role&&botMember&&guild&&role.guild?.id===guild.id&&role.id!==guild.id&&
  !role.managed&&!unsafe.some(flag=>role.permissions.has(flag))&&
  role.comparePositionTo(botMember.roles.highest)<0);
}
export function emojiKey(value){
 if(value&&typeof value==='object')return String(value.id||value.name||'');
 const text=String(value||'').trim();
 return parseEmoji(text)?.id||text;
}
export function validEmojiText(value){
 const text=String(value||'').trim();
 if(!text||text.length>80||/[\r\n@]/.test(text))return false;
 const parsed=parseEmoji(text);
 if(parsed?.id)return /^\d{17,22}$/.test(parsed.id);
 return text.length<=32&&/\p{Extended_Pictographic}/u.test(text)&&
  !/[A-Za-z0-9]/.test(text.replace(/\uFE0F/g,''));
}
export function panelEmbed(row){
 const choices=row.emoji_roles.map(x=>x.emoji+' — <@&'+x.role_id+'>').join('\n');
 return new EmbedBuilder().setColor(0xf5cc57).setTitle(row.title)
  .setDescription(row.description+'\n\n'+choices+
   '\n\n**Reaja para ganhar o cargo. Retire sua reação para remover o cargo.**')
  .setFooter({text:'Duckzinha • Cargos da comunidade'});
}
export class ReactionRolePanels{
 constructor({store,client,guildId,onError=()=>{}}){
  this.store=store;this.client=client;this.guildId=guildId;this.onError=onError;this.cache=new Map();
 }
 ensure(){if(!this.store.persistent)throw Error('O Supabase precisa estar configurado para salvar o painel.');}
 async get(id){
  if(!/^\d{17,22}$/.test(String(id)))return null;
  const hit=this.cache.get(String(id));
  if(hit&&hit.until>Date.now())return hit.data;
  if(!this.store.persistent)return null;
  const data=await this.store.requireResult(this.store.db.from('duckzinha_reaction_roles')
   .select('message_id,guild_id,channel_id,webhook_id,title,description,emoji_roles')
   .eq('guild_id',this.guildId).eq('message_id',id).maybeSingle());
  this.cache.set(String(id),{data,until:Date.now()+30000});
  return data;
 }
 async save(data){
  this.ensure();
  await this.store.requireResult(this.store.db.from('duckzinha_reaction_roles')
    .upsert(data,{onConflict:'message_id'}));
  this.cache.set(String(data.message_id),{data,until:Date.now()+30000});
 }
 async del(id){
  this.ensure();
  await this.store.requireResult(this.store.db.from('duckzinha_reaction_roles')
   .delete().eq('guild_id',this.guildId).eq('message_id',id));
  this.cache.delete(String(id));
 }
 async webhook(channel,id=''){
  const hooks=await channel.fetchWebhooks();
  let hook=id?hooks.get(id):hooks.find(h=>h.owner?.id===this.client.user.id&&h.name===WEBHOOK_NAME&&h.token);
  if(!hook&&!id)hook=await channel.createWebhook({name:WEBHOOK_NAME,reason:'Painel de cargos da comunidade'});
  if(!hook?.token)throw Error('Preciso de Gerenciar webhooks nesse canal.');
  return hook;
 }
 async emoji(guild,raw){
  const text=String(raw||'').trim();
  if(!validEmojiText(text))throw Error('Emoji inválido. Use 🧩 ou <:nome:id>.');
  const p=parseEmoji(text);
  if(p?.id&&!await guild.emojis.fetch(p.id).catch(()=>null))
   throw Error('Esse emoji personalizado não está disponível.');
  return text;
 }
 async checkRole(guild,channel,role){
  const me=guild.members.me||await guild.members.fetchMe();
  if(!validReactionRole(role,me,guild))throw Error('O cargo deve ficar abaixo da Duckzinha e não pode ter poderes de moderação.');
  if(!me.permissions.has(PermissionFlagsBits.ManageRoles))throw Error('Preciso de Gerenciar cargos.');
  const p=channel.permissionsFor(me);
  if(!p?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory,
   PermissionFlagsBits.AddReactions,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))
   throw Error('Preciso de Ver canal, Ler histórico, Enviar mensagens, Adicionar reações e Inserir links. Execute /cargosreacao diagnostico no canal do painel.');
 }
 async diagnose(i,send){
  const guild=i.guild,channel=i.channel;
  const me=guild.members.me||await guild.members.fetchMe();
  const requirements=[
   ['Gerenciar cargos',me.permissions.has(PermissionFlagsBits.ManageRoles)],
   ['Enviar mensagens',Boolean(channel?.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages))],
   ['Ver canal',Boolean(channel?.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel))],
   ['Ler histórico de mensagens',Boolean(channel?.permissionsFor(me)?.has(PermissionFlagsBits.ReadMessageHistory))],
   ['Adicionar reações',Boolean(channel?.permissionsFor(me)?.has(PermissionFlagsBits.AddReactions))],
   ['Inserir links (embeds)',Boolean(channel?.permissionsFor(me)?.has(PermissionFlagsBits.EmbedLinks))]
  ];
  let database='❌ Supabase não configurado na hospedagem';
  if(this.store.persistent){
   try{
    await this.store.requireResult(this.store.db.from('duckzinha_reaction_roles')
     .select('message_id').eq('guild_id',this.guildId).limit(1));
    database='✅ Supabase e tabela duckzinha_reaction_roles acessíveis';
   }catch(err){
    database='❌ Supabase: '+String(err?.message||err).slice(0,180);
   }
  }
  const missing=requirements.filter(x=>!x[1]).length;
  return send('**🦆 Diagnóstico de cargos por reação**\n'+
   requirements.map(([name,ok])=>(ok?'✅ ':'❌ ')+name).join('\n')+
   '\n'+database+
   '\n🔼 Cargo mais alto da Duckzinha: <@&'+me.roles.highest.id+'>'+
   '\n\n'+(missing?'Corrija as permissões marcadas com ❌ nas configurações do servidor/canal.':
    'Permissões desse canal OK. Verifique se o cargo desejado está abaixo da Duckzinha e não é administrativo.')+
   '\nSe o painel for para outro canal, execute este diagnóstico naquele canal.');
 }
 async handleCommand(i){
  if(i.commandName!=='cargosreacao')return false;
  if(i.guildId!==this.guildId||!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
   return i.reply({content:'Somente a equipe pode configurar o painel.',flags:MessageFlags.Ephemeral});
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const send=text=>i.editReply({content:text,allowedMentions:{parse:[]}});
  try{
   const sub=i.options.getSubcommand();
   if(sub==='diagnostico')return this.diagnose(i,send);
   this.ensure();
   if(sub==='criar'){
    const channel=i.options.getChannel('canal')||i.channel;
    if(!channel||channel.guildId!==this.guildId||
      ![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type))
      throw Error('Selecione um canal de texto do servidor.');
    const role=i.options.getRole('cargo');
    await this.checkRole(i.guild,channel,role);
    const e=await this.emoji(i.guild,i.options.getString('emoji'));
    const title=i.options.getString('titulo').trim(),description=i.options.getString('descricao').trim();
    if(!title||!description)throw Error('Título e descrição obrigatórios.');
    // Publicar como a conta real do bot: Discord usa nome, avatar e identidade
    // da Duckzinha automaticamente, sem webhook e sem env nova.
    const data={guild_id:this.guildId,channel_id:channel.id,webhook_id:'',title,description,
      emoji_roles:[{emoji:e,role_id:role.id}]};
    const posted=await channel.send({embeds:[panelEmbed(data)],allowedMentions:{parse:[]}});
    try{
     await posted.react(e);
     data.message_id=posted.id;await this.save(data);
    }catch(err){await posted.delete().catch(()=>{});throw err;}
    return send('✅ Painel publicado em <#'+channel.id+'>!\nID: '+data.message_id+
      '\nAdicione mais opções com /cargosreacao adicionar.');
   }
   const id=i.options.getString('mensagem'),row=await this.get(id);
   if(!row)throw Error('Painel não encontrado. Confira o ID.');
   const channel=await i.guild.channels.fetch(row.channel_id);
   if(!channel)throw Error('Canal do painel não encontrado.');
   if(sub==='ver')return send('**'+row.title+'**\n'+row.emoji_roles.map(x=>x.emoji+' → <@&'+x.role_id+'>').join('\n'));
   if(sub==='editar'){
    const nextTitle=i.options.getString('titulo');
    const nextDescription=i.options.getString('descricao');
    if(nextTitle===null&&nextDescription===null)
      throw Error('Preencha o novo título, a nova descrição ou ambos.');
    if(nextTitle!==null&&!nextTitle.trim()||nextDescription!==null&&!nextDescription.trim())
      throw Error('O título e a descrição não podem ficar vazios.');
    const updated={...row,
      title:nextTitle===null?row.title:nextTitle.trim(),
      description:nextDescription===null?row.description:nextDescription.trim()};
    if(updated.title.length>90||updated.description.length>700)
      throw Error('O título aceita até 90 caracteres e a descrição até 700.');
    const msg=await channel.messages.fetch(id);
    if(row.webhook_id){
      const hook=await this.webhook(channel,row.webhook_id);
      await hook.editMessage(id,{embeds:[panelEmbed(updated)],allowedMentions:{parse:[]}});
    }else{
      if(msg.author.id!==this.client.user.id)
        throw Error('A mensagem não pertence à Duckzinha.');
      await msg.edit({embeds:[panelEmbed(updated)],allowedMentions:{parse:[]}});
    }
    await this.save(updated);
    return send('✅ Texto do painel atualizado na mesma mensagem. Os emojis, cargos e reações foram preservados.');
   }
   if(sub==='migrar'){
    if(!row.webhook_id)return send('✅ Esse painel já é uma mensagem da própria Duckzinha, com o avatar dela.');
    const me=i.guild.members.me||await i.guild.members.fetchMe();
    const p=channel.permissionsFor(me);
    if(!p?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AddReactions,PermissionFlagsBits.EmbedLinks]))
      throw Error('Preciso de Ver canal, Enviar mensagens, Ler histórico, Adicionar reações e Inserir links nesse canal.');
    if(!me.permissions.has(PermissionFlagsBits.ManageRoles))
      throw Error('Preciso de Gerenciar cargos para migrar o painel.');
    for(const choice of row.emoji_roles){
      const role=await i.guild.roles.fetch(choice.role_id).catch(()=>null);
      if(!validReactionRole(role,me,i.guild))
        throw Error('O cargo '+choice.role_id+' está acima da Duckzinha ou tem poderes de moderação. Ajuste-o antes de migrar.');
    }
    // Autor de mensagem webhook é imutável: precisamos criar outra postagem.
    const newMessage=await channel.send({embeds:[panelEmbed(row)],allowedMentions:{parse:[]}});
    const migrated={...row,message_id:newMessage.id,webhook_id:''};
    try{
      for(const choice of row.emoji_roles)await newMessage.react(choice.emoji);
      await this.save(migrated);
    }catch(err){
      await newMessage.delete().catch(()=>{});
      throw err;
    }
    // Desativar primeiro o painel antigo, só então apagar sua mensagem.
    try{await this.del(row.message_id);}
    catch(err){
      // O novo painel fica válido e o antigo também; avisar sem esconder falha.
      this.onError('migrar-desativar-antigo',err);
      return send('⚠️ Publiquei o painel novo em <#'+channel.id+'> (ID: '+newMessage.id+
        '), mas NÃO consegui desativar o painel antigo. Execute /cargosreacao apagar com o ID '+row.message_id+'.');
    }
    let oldRemoved=false;
    try{
      const hook=await this.webhook(channel,row.webhook_id);
      await hook.deleteMessage(row.message_id);
      oldRemoved=true;
    }catch(err){this.onError('migrar-apagar-webhook',err);}
    return send('✅ Painel migrado! Agora é uma mensagem da própria Duckzinha, com a foto dela.'+
      '\nNovo ID: '+newMessage.id+
      '\nOs membros precisam reagir na mensagem nova para manter a seleção sincronizada.'+
      (oldRemoved?'\nA mensagem do webhook antigo foi apagada.':
        '\n⚠️ A mensagem antiga ainda pode aparecer no canal: apague-a manualmente; o painel antigo já foi desativado.'));
   }
   if(sub==='apagar'){
    await this.del(id);
    let removed=false;
    try{
      if(row.webhook_id){
        await (await this.webhook(channel,row.webhook_id)).deleteMessage(id);
      }else{
        const msg=await channel.messages.fetch(id);
        if(msg.author.id!==this.client.user.id)throw Error('A mensagem não pertence à Duckzinha.');
        await msg.delete();
      }
      removed=true;
    }catch(err){this.onError('apagar-painel',err);}
    return send('✅ Painel desativado.'+(removed?' Mensagem apagada.':' Apague a mensagem manualmente, se ainda estiver visível.'));
   }
   const e=await this.emoji(i.guild,i.options.getString('emoji')),key=emojiKey(e);
   const options=[...row.emoji_roles];
   if(sub==='adicionar'){
    const role=i.options.getRole('cargo');
    await this.checkRole(i.guild,channel,role);
    if(options.length>=12)throw Error('Máximo de 12 opções por painel.');
    if(options.some(x=>emojiKey(x.emoji)===key))throw Error('Emoji já cadastrado.');
    options.push({emoji:e,role_id:role.id});
   }else if(sub==='remover'){
    if(options.length<2)throw Error('Use /cargosreacao apagar para remover a última opção.');
    const at=options.findIndex(x=>emojiKey(x.emoji)===key);
    if(at<0)throw Error('Emoji não encontrado.');
    options.splice(at,1);
   }
   const updated={...row,emoji_roles:options};
   const msg=await channel.messages.fetch(id);
   if(sub==='adicionar')await msg.react(e);
   if(row.webhook_id){
     // Compatibilidade com painéis legados, até serem migrados.
     const hook=await this.webhook(channel,row.webhook_id);
     await hook.editMessage(id,{embeds:[panelEmbed(updated)],allowedMentions:{parse:[]}});
   }else{
     if(msg.author.id!==this.client.user.id)throw Error('A mensagem não pertence à Duckzinha.');
     await msg.edit({embeds:[panelEmbed(updated)],allowedMentions:{parse:[]}});
   }
   await this.save(updated);
   if(sub==='remover'){
    const reaction=msg.reactions.cache.find(x=>emojiKey(x.emoji)===key);
    await reaction?.remove().catch(err=>this.onError('limpar reação',err));
   }
   return send('✅ Painel atualizado com '+options.length+' cargo(s).');
  }catch(err){this.onError('comando',err);return send('⚠️ '+String(err.message||err).slice(0,350));}
 }
 async handleReaction(reaction,user,adding){
  if(user?.bot||reaction.message?.guildId!==this.guildId)return;
  try{
   if(reaction.partial)reaction=await reaction.fetch();
   const row=await this.get(reaction.message.id);
   if(!row||row.channel_id!==reaction.message.channelId)return;
   const selected=row.emoji_roles.find(x=>emojiKey(x.emoji)===emojiKey(reaction.emoji));
   if(!selected)return;
   const guild=reaction.message.guild||await this.client.guilds.fetch(this.guildId);
   const member=await guild.members.fetch(user.id).catch(()=>null);
   if(!member||member.user?.bot)return;
   const role=await guild.roles.fetch(selected.role_id).catch(()=>null);
   const me=guild.members.me||await guild.members.fetchMe();
   if(!validReactionRole(role,me,guild)||!me.permissions.has(PermissionFlagsBits.ManageRoles))return;
   if(adding&&!member.roles.cache.has(role.id))
    await member.roles.add(role,'Selecionou cargo por reação na Duckzinha');
   if(!adding&&member.roles.cache.has(role.id))
    await member.roles.remove(role,'Removeu reação do painel Duckzinha');
  }catch(err){this.onError(adding?'adicionar':'remover',err);}
 }
}
