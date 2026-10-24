import {AttachmentBuilder,EmbedBuilder,MessageFlags,PermissionFlagsBits,SlashCommandBuilder} from 'discord.js';
import {renderAvatar} from './duck-avatar.mjs';
import {voiceReadableText} from './voice-visit.mjs';
import {synthesizeDuckSpeech} from './duck-tts.mjs';
import {expressiveVoice} from './duck-extras.mjs';
import {convertToVoiceMessage,sendNativeVoice} from './duck-voice-message.mjs';
import {renderProfileCard} from './duck-profile-card.mjs';
import {animatedDuckReaction} from './duck-animated-reactions.mjs';
export {runMessageMenu} from './duck-message-menu.mjs';

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
    new SlashCommandBuilder().setName('falar').setDescription('Enviar mensagem de voz da Duckzinha (somente admin)')
      .addStringOption(o=>o.setName('texto').setDescription('Texto a ser falado').setRequired(true).setMinLength(1).setMaxLength(250))
      .addStringOption(o=>o.setName('expressao').setDescription('Como a Duckzinha deve falar')
       .addChoices({name:'Automática',value:'auto'},{name:'Animada',value:'animada'},
         {name:'Calma',value:'calma'},{name:'Curiosa',value:'curiosa'},
         {name:'Sonolenta',value:'sonolenta'}))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false),
    new SlashCommandBuilder().setName('reacao').setDescription('Enviar uma reação ilustrada da Duckzinha')
      .addStringOption(o=>o.setName('tipo').setDescription('Reação').setRequired(true).addChoices(
        {name:'Olá',value:'ola'},{name:'Rindo',value:'riso'},{name:'Fofo',value:'fofo'},
        {name:'GG',value:'gg'},{name:'Surpresa',value:'surpresa'})).setDMPermission(false),
    new SlashCommandBuilder().setName('novidade').setDescription('Publicar atualização dos projetos (admin)')
      .addSubcommand(s=>s.setName('publicar').setDescription('Cole o anúncio pronto com título e descrição juntos')
        .addStringOption(o=>o.setName('texto').setDescription('Cole tudo, incluindo #, **, > e quebras de linha').setRequired(true).setMaxLength(1800)))
      .setDMPermission(false),
    new SlashCommandBuilder().setName('novidades').setDescription('Mostrar as últimas atualizações publicadas').setDMPermission(false),
    new SlashCommandBuilder().setName('card').setDescription('Cartão de perfil da comunidade em PNG')
      .addUserOption(x=>x.setName('usuario').setDescription('Membro (opcional)')).setDMPermission(false),
    new SlashCommandBuilder().setName('inventario').setDescription('Mostra seus cinco conjuntos de cosméticos salvos').setDMPermission(false),
    new SlashCommandBuilder().setName('minigame').setDescription('Iniciar um jogo curto para todos do canal')
      .addStringOption(x=>x.setName('tipo').setDescription('Escolha o minigame').addChoices(
        {name:'Aleatório',value:'aleatorio'},
        {name:'Verdadeiro ou falso',value:'verdadeiro-ou-falso'},
        {name:'Adivinhe o mob',value:'adivinhe-o-mob'},
        {name:'Matemática',value:'matematica'},
        {name:'Minecraft',value:'desafio-mine'},
        {name:'Geografia',value:'geografia'})).setDMPermission(false),
    new SlashCommandBuilder().setName('moedas').setDescription('Consultar suas moedas de pato').setDMPermission(false),
    new SlashCommandBuilder().setName('afk').setDescription('Iniciar ou resgatar recompensa AFK')
      .addStringOption(x=>x.setName('acao').setDescription('Começar ou resgatar').setRequired(true)
        .addChoices({name:'Iniciar',value:'iniciar'},{name:'Resgatar',value:'resgatar'})).setDMPermission(false),
    new SlashCommandBuilder().setName('coinflip').setDescription('Caro ou coroa com 3 rodadas, sem apostas')
      .addUserOption(o=>o.setName('jogador').setDescription('Pessoa para desafiar').setRequired(true)).setDMPermission(false),
    new SlashCommandBuilder().setName('enviar').setDescription('Enviar moedas de pato a outro membro')
      .addUserOption(o=>o.setName('jogador').setDescription('Quem vai receber').setRequired(true))
      .addIntegerOption(o=>o.setName('valor').setDescription('Quantidade de moedas (1–500)').setRequired(true)
        .setMinValue(1).setMaxValue(500)).setDMPermission(false),
    new SlashCommandBuilder().setName('emblema').setDescription('Loja de emblemas com cargos especiais')
      .addSubcommand(o=>o.setName('loja').setDescription('Consultar emblemas disponíveis'))
      .addSubcommand(o=>o.setName('publicar').setDescription('Publicar painel da loja aqui (admin)'))
      .addSubcommand(o=>o.setName('configurar').setDescription('Configurar emblema, cargo e preço (admin)')
        .addStringOption(x=>x.setName('tipo').setDescription('Qual emblema?').setRequired(true)
          .addChoices({name:'Bronze',value:'bronze'},{name:'Prata',value:'prata'},
            {name:'Ouro',value:'ouro'},{name:'Diamante',value:'diamante'}))
        .addRoleOption(x=>x.setName('cargo').setDescription('Cargo concedido ao comprar').setRequired(true))
        .addIntegerOption(x=>x.setName('preco').setDescription('Preço em moedas')
          .setRequired(true).setMinValue(1).setMaxValue(100000)))
      .setDMPermission(false),
    new SlashCommandBuilder().setName('diario').setDescription('Painel de recompensa de 20 moedas diárias')
      .addSubcommand(x=>x.setName('publicar').setDescription('Publicar botão de recompensa diária aqui (admin)'))
      .setDMPermission(false),
    new SlashCommandBuilder().setName('campeonato').setDescription('Campeonato público de quiz')
      .addSubcommand(s=>s.setName('iniciar').setDescription('Começar campeonato para todos'))
      .setDMPermission(false)
  ].map(x=>x.toJSON());
}

const flags=MessageFlags.Ephemeral;
const reply=(interaction,content)=>interaction.reply({content,flags,allowedMentions:{parse:[]}});
const lastVoice=new Map(),lastArt=new Map();

export async function runNewCommand(interaction,{
  store,extras,studio,community,selectedVoice,findReactionFile
}={}){
  if(!interaction.inGuild()||interaction.guildId!==store.guildId)return false;
  const name=interaction.commandName;
  if(!['avatar','painel','ver','perfil','jogo','falar','reacao','novidade','novidades','card','inventario','coinflip','enviar','emblema','diario','minigame','moedas','afk','campeonato'].includes(name))return false;
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
  if(name==='coinflip'){await community.coinFlip(interaction);return true;}
  if(name==='enviar'){await community.transfer(interaction);return true;}
  if(name==='emblema'){await community.badgeCommand(interaction);return true;}
  if(name==='diario'){await community.dailyCommand(interaction);return true;}
  if(name==='moedas'||name==='afk'){await community.economy(interaction);return true;}
  if(name==='minigame'){await community.game(interaction);return true;}
  if(name==='campeonato'){await extras.startGame(interaction,{championship:true});return true;}
  if(name==='inventario'){
    const items=await store.getLoadouts(interaction.user.id);
    await reply(interaction,'🎒 **Seus conjuntos de patinhos**\n'+
      Array.from({length:5},(_,i)=>'Visual '+(i+1)+': '+(items.find(x=>x.slot===i+1)?'salvo ✅':'vazio')).join('\n')+
      '\n\nPara guardar ou equipar um visual, abra /avatar e use o Inventário do Studio.');
    return true;
  }
  if(name==='card'){
    const user=interaction.options.getUser('usuario')||interaction.user;
    const member=await interaction.guild.members.fetch(user.id).catch(()=>null);
    if(!member){await reply(interaction,'Esse membro não está no servidor.');return true;}
    await interaction.deferReply();
    const avatar=await store.getAvatar(user.id).catch(()=>null);
    const coins=await store.getBalance(user.id).catch(()=>0);
    const image=renderProfileCard({name:member.displayName,avatar,coins,streak:extras.score(user.id),
      title:coins>=100?'Colecionador':extras.score(user.id)>=5?'Mestre do Quiz':'Explorador'});
    await interaction.editReply({files:[new AttachmentBuilder(image,{name:'duckzinha-card.png'})],allowedMentions:{parse:[]}});
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
    // Defense-in-depth: mesmo que alguém exiba o slash command por cache/permissões,
    // nunca gerar, enviar ou consumir cooldown se não for administrador.
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)){
      await reply(interaction,'🔒 Apenas administradores podem usar /falar.');
      return true;
    }
    const now=Date.now(),prev=lastVoice.get(interaction.user.id)||0;
    if(now-prev<20000){await reply(interaction,'Espere 20 segundos antes de enviar outro áudio.');return true;}
    const text=interaction.options.getString('texto',true).trim();
    if(!text||/@everyone|@here|<@!?\d+>/.test(text)){await reply(interaction,'Use texto normal, sem menções.');return true;}
    lastVoice.set(interaction.user.id,now);
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try{
      const emotion=interaction.options.getString('expressao');
      const selected=expressiveVoice(selectedVoice(),emotion&&emotion!=='auto'?emotion:extras.mood(text),extras.settings.emotionalVoice);
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
    let result=file;
    if(!result){
      try{result=new AttachmentBuilder(await animatedDuckReaction(type),{name:'duckzinha-'+type+'.gif'});}
      catch(err){console.warn('[Duckzinha] GIF animado indisponível: '+err.message);}
    }
    if(!result){await reply(interaction,'Não consegui gerar a animação agora.');return true;}
    lastArt.set(interaction.user.id,Date.now());
    await interaction.reply({content:'🦆💛 Reação: '+type,files:[result],allowedMentions:{parse:[]}});
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
    if(!channel.permissionsFor(bot)?.has(PermissionFlagsBits.MentionEveryone)){
      await reply(interaction,'Para avisar @everyone, preciso da permissão Mencionar @everyone neste canal.');return true;
    }
    if(!store.persistent){await reply(interaction,'Configure o Supabase e aplique a migração SQL antes de publicar novidades.');return true;}
    await interaction.deferReply({flags});
    try{
      await store.addProjectUpdate(title,description,interaction.user.id);
      await channel.send({content:'@everyone\n\n'+announcement,allowedMentions:{parse:['everyone']}});
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
