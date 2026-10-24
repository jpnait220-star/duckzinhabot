import {ChannelType,EmbedBuilder,MessageFlags,PermissionFlagsBits} from 'discord.js';

const ADMIN=PermissionFlagsBits.Administrator;
const IDS=/^\d{17,22}$/;
const safe=s=>String(s||'').replace(/[@*_\x60~|<>\\]/g,'').replace(/[\r\n]/g,' ').slice(0,200).trim()||'Não informado';
const hidden=content=>({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});

export async function configureModerationLogs(interaction,{store}={}){
  if(!interaction.inGuild?.()||!interaction.memberPermissions?.has(ADMIN))
    return interaction.reply(hidden('🔒 Só administradores podem configurar o canal de logs.'));
  if(!store?.persistent)return interaction.reply(hidden('⚠️ Preciso do Supabase ativo para guardar o canal de logs após reiniciar.'));
  const choice=interaction.options.getSubcommand();
  try{
    if(choice==='ver'){
      const id=(await store.getFeatureSettings()).modLogChannelId;
      return interaction.reply(hidden(id&&IDS.test(id)
        ?'📋 **Logs de moderação**\nCanal atual: <#'+id+'>.'
        :'📋 Ainda não há canal configurado. Use /modlog configurar.'));
    }
    if(choice==='configurar'){
      const channel=interaction.options.getChannel('canal',true);
      if(!channel||channel.guildId!==interaction.guildId||
        ![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type))
        return interaction.reply(hidden('⚠️ Escolha um canal de texto deste servidor.'));
      const me=interaction.guild.members.me||await interaction.guild.members.fetchMe();
      if(!channel.permissionsFor(me)?.has([
        PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks
      ]))return interaction.reply(hidden('⚠️ Preciso de Ver canal, Enviar mensagens e Inserir links nesse canal.'));
      const settings=await store.getFeatureSettings();
      await store.setFeatureSettings({...settings,modLogChannelId:channel.id},interaction.user.id);
      return interaction.reply(hidden('✅ **Logs ativados!**\nVou registrar bans, desbans e castigos em <#'+channel.id+'>. 🦆'));
    }
    if(choice==='desativar'){
      const settings=await store.getFeatureSettings();
      delete settings.modLogChannelId;
      await store.setFeatureSettings(settings,interaction.user.id);
      return interaction.reply(hidden('✅ Logs automáticos desativados.'));
    }
    return interaction.reply(hidden('Opção inválida.'));
  }catch(error){
    console.warn('[Duckzinha] Configuração modlog: '+String(error?.message||error));
    return interaction.reply(hidden('⚠️ Não consegui salvar o canal de logs. Confira o Supabase e minhas permissões.'));
  }
}

export function moderationLogEmbed({action,target,moderator,reason,durationMs,at=new Date()}){
  const styles={
    ban:{title:'🔨 Banimento registrado',color:0xF26363,action:'Banimento'},
    unban:{title:'✅ Banimento removido',color:0x69D4A0,action:'Desbanimento'},
    timeout:{title:'🔇 Castigo aplicado',color:0xF0C26B,action:'Castigo temporário'},
    untimeout:{title:'🔊 Castigo removido',color:0x72BAEB,action:'Remoção de castigo'}
  };
  const entry=styles[action];
  if(!entry)throw new Error('Ação de moderação inválida.');
  const embed=new EmbedBuilder().setTitle(entry.title).setColor(entry.color)
    .setDescription('Registro de moderação • Duckzinha')
    .addFields(
      {name:'👤 Usuário',value:safe(target?.username)+'\nID: '+target.id,inline:true},
      {name:'🛡️ Administrador',value:safe(moderator?.username)+'\nID: '+moderator.id,inline:true},
      {name:'📌 Ação',value:entry.action,inline:false},
      {name:'📝 Motivo',value:safe(reason).slice(0,800),inline:false}
    )
    .setTimestamp(at)
    .setFooter({text:'Duckzinha • Histórico de moderação'});
  if(action==='timeout')embed.addFields({
    name:'⏳ Duração',value:formatModerationDuration(durationMs),inline:true
  });
  return embed;
}
export function formatModerationDuration(ms){
  const n=Math.max(0,Number(ms)||0);
  if(n%86400000===0)return (n/86400000)+' dia(s)';
  if(n%3600000===0)return (n/3600000)+' hora(s)';
  if(n%60000===0)return (n/60000)+' minuto(s)';
  return Math.round(n/1000)+' segundo(s)';
}
export async function sendModerationLog({message,store,action,target,reason,durationMs}){
  if(!store?.persistent)return {ok:true,configured:false};
  let config;
  try{config=await store.getFeatureSettings();}
  catch(error){return {ok:false,reason:'Não foi possível ler o canal de logs: '+String(error?.message||error)};}
  const channelId=config?.modLogChannelId;
  if(!channelId)return {ok:true,configured:false};
  if(!IDS.test(channelId))return {ok:false,reason:'ID do canal de logs inválido.'};
  try{
    const channel=await message.guild.channels.fetch(channelId);
    if(!channel||channel.guildId!==message.guild.id||typeof channel.send!=='function')
      throw Error('Canal não encontrado neste servidor.');
    const me=message.guild.members.me||await message.guild.members.fetchMe();
    if(!channel.permissionsFor(me)?.has([
      PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks
    ]))throw Error('Preciso de Ver canal, Enviar mensagens e Inserir links.');
    await channel.send({
      embeds:[moderationLogEmbed({action,target,moderator:message.author,reason,durationMs})],
      allowedMentions:{parse:[]}
    });
    return {ok:true,configured:true};
  }catch(error){
    const why=String(error?.message||error).slice(0,200);
    console.warn('[Duckzinha] Não consegui enviar modlog: '+why);
    return {ok:false,reason:why};
  }
}
