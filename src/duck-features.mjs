import {AttachmentBuilder,EmbedBuilder,MessageFlags,PermissionFlagsBits,SlashCommandBuilder} from 'discord.js';
import {renderAvatar} from './duck-avatar.mjs';
import {voiceReadableText} from './voice-visit.mjs';
import {synthesizeDuckSpeech} from './duck-tts.mjs';
import {expressiveVoice} from './duck-extras.mjs';
import {convertToVoiceMessage,sendNativeVoice} from './duck-voice-message.mjs';

export function newCommands(){
  return [
    new SlashCommandBuilder().setName('avatar').setDescription('Abra o site e customize seu pato').setDMPermission(false),
    new SlashCommandBuilder().setName('painel').setDescription('Abrir o painel administrativo no site').setDMPermission(false),
    new SlashCommandBuilder().setName('ver').setDescription('Ver avatares da comunidade')
      .addSubcommand(s=>s.setName('pessoa').setDescription('Mostrar o avatar de alguém')
        .addUserOption(o=>o.setName('usuario').setDescription('Pessoa a visualizar').setRequired(false))).setDMPermission(false),
    new SlashCommandBuilder().setName('perfil').setDescription('Meu perfil visual de comunidade')
      .addUserOption(o=>o.setName('usuario').setDescription('Outro membro').setRequired(false)).setDMPermission(false),
    new SlashCommandBuilder().setName('jogo').setDescription('Brinque com os minigames da Duckzinha')
      .addSubcommand(s=>s.setName('quiz').setDescription('Iniciar quiz público para todos do canal'))
      .addSubcommand(s=>s.setName('parar').setDescription('Encerrar quiz deste canal (moderação)'))
      .setDMPermission(false),
    new SlashCommandBuilder().setName('falar').setDescription('Gerar uma mensagem de áudio com a voz da Duckzinha')
      .addStringOption(o=>o.setName('texto').setDescription('Texto a ser falado').setRequired(true).setMinLength(1).setMaxLength(250))
      .setDMPermission(false),
    new SlashCommandBuilder().setName('reacao').setDescription('Enviar uma reação ilustrada da Duckzinha')
      .addStringOption(o=>o.setName('tipo').setDescription('Reação').setRequired(true).addChoices(
        {name:'Olá',value:'ola'},{name:'Rindo',value:'riso'},{name:'Fofo',value:'fofo'},
        {name:'GG',value:'gg'},{name:'Surpresa',value:'surpresa'})).setDMPermission(false),
    new SlashCommandBuilder().setName('novidade').setDescription('Publicar atualização dos projetos (admin)')
      .addSubcommand(s=>s.setName('publicar').setDescription('Cole o anúncio pronto com título e descrição juntos')
        .addStringOption(o=>o.setName('texto').setDescription('Cole tudo, incluindo #, **, > e quebras de linha').setRequired(true).setMaxLength(1800)))
      .setDMPermission(false),
    new SlashCommandBuilder().setName('novidades').setDescription('Mostrar as últimas atualizações publicadas').setDMPermission(false)
  ].map(x=>x.toJSON());
}

const flags=MessageFlags.Ephemeral;
const reply=(interaction,content)=>interaction.reply({content,flags,allowedMentions:{parse:[]}});
const lastVoice=new Map(),lastArt=new Map();

export async function runNewCommand(interaction,{
  store,extras,studio,selectedVoice,findReactionFile
}={}){
  if(!interaction.inGuild()||interaction.guildId!==store.guildId)return false;
  const name=interaction.commandName;
  if(!['avatar','painel','ver','perfil','jogo','falar','reacao','novidade','novidades'].includes(name))return false;
  if(name==='avatar'||name==='painel'){
    const isAdmin=Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
    if(name==='painel'&&!isAdmin){await reply(interaction,'Este painel é só para administradores.');return true;}
    const member=await interaction.guild.members.fetch(interaction.user.id);
    const link=studio.link(name,member,isAdmin);
    if(link){
      await reply(interaction,'🦆💛 **Duckzinha Studio**\nAbra seu acesso individual (expira em 5 minutos):\n'+link+
        '\nNão compartilhe este link: ele permite editar seu avatar.');
    }else{
      await reply(interaction,'Ative **Settings → Web address → Enable** na FadeHost para abrir o Studio. Nenhuma ENV extra é necessária.');
    }
    return true;
  }
  if(name==='jogo'){
    const sub=interaction.options.getSubcommand();
    if(sub==='parar'){
      if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages))
        await reply(interaction,'Apenas a moderação pode encerrar o quiz.');
      else await extras.stopGame(interaction);
      return true;
    }
    await extras.startGame(interaction);
    return true;
  }
  if(name==='ver'||name==='perfil'){
    const memberUser=name==='ver'
      ?interaction.options.getUser('usuario')||interaction.user
      :interaction.options.getUser('usuario')||interaction.user;
    const m=await interaction.guild.members.fetch(memberUser.id).catch(()=>null);
    if(!m){await reply(interaction,'Essa pessoa não está no servidor.');return true;}
    await interaction.deferReply();
    let avatar=null;
    try{avatar=await store.getAvatar(m.id);}catch(err){console.warn('[Duckzinha] Avatar: '+err.message);}
    const attachment=new AttachmentBuilder(renderAvatar(avatar),{name:'duckzinha-avatar.png'});
    const embed=new EmbedBuilder().setColor(0xffd75b)
      .setTitle('🦆 Avatar de '+m.displayName.slice(0,65))
      .setDescription('Feito no Duckzinha Studio 💛\nPersonalize o seu usando `/avatar`.')
      .setImage('attachment://duckzinha-avatar.png');
    if(name==='perfil'&&memberUser.id===interaction.user.id)
      embed.addFields({name:'🎮 Quiz Streak',value:'🏆 Recorde: '+extras.score(m.id)+'\n🔥 Sequência atual: '+extras.streak(m.id),inline:true});
    await interaction.editReply({embeds:[embed],files:[attachment],allowedMentions:{parse:[]}});
    return true;
  }
  if(name==='falar'){
    const now=Date.now(),prev=lastVoice.get(interaction.user.id)||0;
    if(now-prev<20000){await reply(interaction,'Espere 20 segundos antes de enviar outro áudio.');return true;}
    const text=interaction.options.getString('texto',true).trim();
    if(!text||/@everyone|@here|<@!?\d+>/.test(text)){await reply(interaction,'Use texto normal, sem menções.');return true;}
    lastVoice.set(interaction.user.id,now);
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try{
      const selected=expressiveVoice(selectedVoice(),extras.mood(text),extras.settings.emotionalVoice);
      const audio=await synthesizeDuckSpeech({text:voiceReadableText(text),voice:selected});
      const converted=await convertToVoiceMessage(audio);
      await sendNativeVoice(interaction,converted);
      await interaction.editReply('🎤 Mensagem de voz da Duckzinha enviada no chat! 💛');
    }catch(err){
      await interaction.editReply('Não consegui enviar a mensagem de voz nativa: '+
        String(err.message).slice(0,185));
    }
    return true;
  }
  if(name==='reacao'){
    if(!extras.settings.specialReactions){await reply(interaction,'As reações especiais foram desativadas no painel.');return true;}
    const last=lastArt.get(interaction.user.id)||0;
    if(Date.now()-last<15000){await reply(interaction,'Espere 15 segundos antes de enviar outra reação.');return true;}
    const type=interaction.options.getString('tipo',true);
    const file=await findReactionFile(type);
    if(!file){await reply(interaction,'Ainda não existe arte para esta reação no projeto.');return true;}
    lastArt.set(interaction.user.id,Date.now());
    await interaction.reply({content:'🦆💛 Reação: '+type,files:[file],allowedMentions:{parse:[]}});
    return true;
  }
  if(name==='novidade'){
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)){
      await reply(interaction,'Só a equipe pode anunciar atualizações.');return true;
    }
    // Um campo: Markdown Discord enviado como texto, sem Embed (Embeds não
    // renderizam # cabeçalhos e citações exatamente como mensagens normais).
    const announcement=interaction.options.getString('texto',true).trim();
    if(!announcement||announcement.length>1800){
      await reply(interaction,'Cole um anúncio de até 1800 caracteres.');return true;
    }
    const title=announcement.split(/\r?\n/)[0]
      .replace(/^\s{0,3}#{1,6}\s*/,'').replace(/[*_~`]/g,'').slice(0,80).trim()||'Novidade';
    const description=announcement.slice(0,1800);
    const channel=interaction.channel,bot=interaction.guild.members.me||await interaction.guild.members.fetchMe();
    if(!channel?.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages])){
      await reply(interaction,'Preciso das permissões Ver canal e Enviar mensagens.');return true;
    }
    if(!store.persistent){await reply(interaction,'Configure o Supabase e aplique a migração SQL antes de publicar novidades.');return true;}
    await interaction.deferReply({flags});
    try{
      await store.addProjectUpdate(title,description,interaction.user.id);
      await channel.send({content:announcement,allowedMentions:{parse:[]}});
      await interaction.editReply('Atualização publicada e guardada! 💛');
    }catch(err){await interaction.editReply('Falha ao publicar: '+String(err.message).slice(0,190));}
    return true;
  }
  if(name==='novidades'){
    const items=await store.listProjectUpdates().catch(()=>[]);
    await reply(interaction,items.length?'📣 **Novidades recentes:**\n'+items.map(x=>'• **'+x.title+'** — '+x.description.slice(0,160)).join('\n').slice(0,1600):
      'Ainda não há novidades registradas.');
    return true;
  }
  return false;
}
