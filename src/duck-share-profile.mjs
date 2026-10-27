import {
  ActionRowBuilder,AttachmentBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,
  MessageFlags,SlashCommandBuilder
} from 'discord.js';

// Apenas membros com este cargo podem publicar. Quem vê a mensagem pode copiar.
export const PROFILE_PUBLISH_ROLE_ID='1564363880443158668';
export const PROFILE_COPY_BUTTON_ID='duckprofile:copy';
export const MAX_PROFILE_LENGTH=3500;

export function profileCommand(){
  return new SlashCommandBuilder().setName('profile')
    .setDescription('Compartilhar um código de perfil DZ3 com botão de cópia')
    .setDMPermission(false)
    .addStringOption(o=>o.setName('codigo')
      .setDescription('Cole seu perfil completo, começando por DZ3:e:')
      .setRequired(true).setMinLength(10).setMaxLength(MAX_PROFILE_LENGTH))
    .toJSON();
}

export function validProfileCode(value){
  return typeof value==='string'&&value.length>=10&&
    value.length<=MAX_PROFILE_LENGTH&&/^DZ3:e:[A-Za-z0-9_-]+$/.test(value);
}

export function canPostProfile(member){
  const roles=member?.roles;
  return Boolean(roles?.cache?.has?.(PROFILE_PUBLISH_ROLE_ID)||
    (Array.isArray(roles)&&roles.includes(PROFILE_PUBLISH_ROLE_ID)));
}

export function profileEmbed({userId,code}){
  return new EmbedBuilder()
    .setColor(0xf5cc57)
    .setTitle('🦆・PROFILE DZ3')
    .setDescription(
      'Perfil compartilhado por <@'+userId+'>.\n\n'+
      '**Código DZ3** (toque para revelar):\n'+
      '||'+code+'||\n\n'+
      '📋 Clique em **Copiar Profile** para abrir o código pronto para copiar.')
    .setFooter({text:'Duckzinha • Perfis da comunidade'});
}

export function profileCopyRow(){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PROFILE_COPY_BUTTON_ID)
      .setLabel('Copiar Profile').setEmoji('📋').setStyle(ButtonStyle.Primary)
  );
}

export function extractProfileCode(message){
  const desc=message?.embeds?.[0]?.description||'';
  const match=/(?:^|\n)\|\|(DZ3:e:[A-Za-z0-9_-]+)\|\|(?:\n|$)/.exec(desc);
  return match&&validProfileCode(match[1])?match[1]:null;
}

export async function handleProfileCommand(interaction,{guildId}={}){
  if(interaction.commandName!=='profile')return false;
  if(!interaction.inGuild?.()||interaction.guildId!==guildId)
    return interaction.reply({content:'Este comando só funciona na Duckzin Community.',
      flags:MessageFlags.Ephemeral});
  if(!canPostProfile(interaction.member))
    return interaction.reply({
      content:'🔒 Apenas membros com o cargo <@&'+PROFILE_PUBLISH_ROLE_ID+
        '> podem publicar perfis. Todos podem usar o botão para copiar os perfis já publicados.',
      allowedMentions:{parse:[]},flags:MessageFlags.Ephemeral
    });

  const code=String(interaction.options.getString('codigo',true)||'').trim();
  const tick=String.fromCharCode(96);
  if(!validProfileCode(code))
    return interaction.reply({
      content:'⚠️ Código de perfil inválido. Cole um código DZ3 completo (começando em '+tick+'DZ3:e:'+tick+'), sem espaços ou linhas extras.',
      flags:MessageFlags.Ephemeral
    });
  return interaction.reply({
    embeds:[profileEmbed({userId:interaction.user.id,code})],
    components:[profileCopyRow()],
    allowedMentions:{parse:[]}
  });
}

export async function handleProfileCopy(interaction,{guildId,botId}={}){
  if(interaction.customId!==PROFILE_COPY_BUTTON_ID)return false;
  if(interaction.guildId!==guildId||interaction.message?.author?.id!==botId)
    return interaction.reply({
      content:'Não consegui confirmar a origem deste perfil.',
      flags:MessageFlags.Ephemeral
    });
  const code=extractProfileCode(interaction.message);
  if(!code)return interaction.reply({
    content:'Esse perfil está indisponível ou o código foi alterado.',
    flags:MessageFlags.Ephemeral
  });
  // Um bloco de código oferece a ação "Copiar" da própria interface do Discord.
  if(code.length<=1850){
    const fence=String.fromCharCode(96).repeat(3);
    return interaction.reply({
      content:'📋 **Copie o Profile DZ3 abaixo:**\n'+fence+'text\n'+code+'\n'+fence,
      flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}
    });
  }
  // Para códigos maiores, um TXT evita ultrapassar os 2000 caracteres do Discord.
  return interaction.reply({
    content:'📋 Seu código está no arquivo **Profile-DZ3.txt**. Abra para copiar.',
    files:[new AttachmentBuilder(Buffer.from(code,'utf8'),{name:'Profile-DZ3.txt'})],
    flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}
  });
}
