import {EmbedBuilder,MessageFlags,PermissionFlagsBits,SlashCommandBuilder} from 'discord.js';
import {ticketGuide} from './community-social.mjs';
import {voiceChoices,voiceLabel,validVoice} from './duck-tts.mjs';
import {newCommands} from './duck-features.mjs';
import {reactionRoleCommands} from './duck-reaction-roles.mjs';
import {profileCommand} from './duck-share-profile.mjs';
import {contextCommands} from './duck-message-menu.mjs';
import {memberHelpEmbeds,MEMBER_HELP_CATEGORIES} from './duck-member-help.mjs';
import {showBoxPvp,manageBoxPvp} from './duck-boxpvp-directory.mjs';

const gold=0xf7d65b;
const choice=[
  ['ajuda','Veja tudo que a Duckzinha pode fazer'],
  ['website','Conheça nosso site e como ele funciona'],
  ['ticket','Saiba onde abrir um ticket'],
  ['explicarproblema','Como explicar um problema à equipe em um ticket'],
  ['projetos','Mods, apps e downloads da comunidade'],
  ['boxpvp','Veja IPs de servidores BoxPvP cadastrados pela equipe'],
  ['faq','Perguntas frequentes'],
  ['sobre','Quem é a Duckzinha'],
  ['ping','Confira se estou online']
];

export function commandPayloads(){
  const list=choice.map(([name,description])=>{
    const builder=new SlashCommandBuilder().setName(name)
      .setDescription(description).setDMPermission(false);
    if(name==='ajuda')builder.addStringOption(option=>option
      .setName('categoria').setDescription('Ver todos os comandos ou apenas uma categoria')
      .setRequired(false).addChoices(...MEMBER_HELP_CATEGORIES));
    return builder.toJSON();
  });
  list.push(new SlashCommandBuilder().setName('testaria')
    .setDescription('Testar diretamente o Cloudflare Workers AI, sem Groq (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('testarreacao')
    .setDescription('Testar o emoji da Duckzinha na sua última mensagem')
    .addStringOption(o=>o.setName('tipo').setDescription('Qual reação verificar?')
      .addChoices(
        {name:'Olá / acenando',value:'ola'},
        {name:'Riso',value:'riso'},
        {name:'Fofura',value:'fofo'},
        {name:'GG',value:'gg'},
        {name:'Surpresa',value:'surpresa'}
      )).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('amizade')
    .setDescription('Ver o quanto a Duckzinha já conversou com você').setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('duckzinha').setDescription('Memória da Duckzinha')
    .addSubcommand(x=>x.setName('reset').setDescription('Apagar memória dos membros (admin)'))
    .addSubcommand(x=>x.setName('apagar-me').setDescription('Apagar meus dados da memória'))
    .addSubcommand(x=>x.setName('minhas-memorias').setDescription('Consultar informações pessoais lembradas'))
    .addSubcommand(x=>x.setName('entrar').setDescription('Entrar na sua call, inclusive privada quando tiver permissão'))
    .addSubcommand(x=>x.setName('sair').setDescription('Sair da call em que você está'))
    .addSubcommand(x=>x.setName('testevoz').setDescription('Ouvir uma expressão específica na sua call (admin)')
      .addStringOption(o=>o.setName('estilo').setDescription('Compare estilos distintos de voz')
        .addChoices(
          {name:'Normal',value:'normal'},
          {name:'Animada',value:'animada'},
          {name:'Calma',value:'calma'},
          {name:'Curiosa',value:'curiosa'},
          {name:'Sonolenta',value:'sonolenta'},
          {name:'Piada',value:'piada'}
        )))
    .addSubcommand(x=>x.setName('voice').setDescription('Escolher a voz brasileira da Duckzinha (admin)')
      .addStringOption(o=>o.setName('nome').setDescription('Vozes-base com timbres Edge distintos').setRequired(true)
        .addChoices(...voiceChoices())))
    .setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('configurar')
    .setDescription('Enviar um TXT com a personalidade da Duckzinha (admin)')
    .addAttachmentOption(x=>x.setName('arquivo').setDescription('Arquivo .txt com até 8 mil caracteres').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('ensinar').setDescription('Ensinar um assunto à Duckzinha (admin)')
    .addStringOption(o=>o.setName('assunto').setDescription('Palavra-chave, exemplo boxpvp').setRequired(true).setMaxLength(50))
    .addStringOption(o=>o.setName('texto').setDescription('Explicação que ela poderá usar').setRequired(true).setMaxLength(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('ensinamentos').setDescription('Ver ou apagar conhecimentos ensinados (admin)')
    .addSubcommand(s=>s.setName('listar').setDescription('Listar assuntos que foram ensinados'))
    .addSubcommand(s=>s.setName('apagar').setDescription('Apagar um assunto da memória da comunidade')
      .addStringOption(o=>o.setName('assunto').setDescription('Nome do assunto').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('boxpvpadmin')
    .setDescription('Gerenciar IPs BoxPvP aprovados nos tickets (admin)')
    .addSubcommand(s=>s.setName('adicionar').setDescription('Cadastrar servidor após aprovar um ticket')
      .addStringOption(o=>o.setName('nome').setDescription('Nome do servidor').setRequired(true).setMaxLength(56))
      .addStringOption(o=>o.setName('ip').setDescription('Endereço ou IP com porta opcional').setRequired(true).setMaxLength(253)))
    .addSubcommand(s=>s.setName('remover').setDescription('Remover um IP do catálogo')
      .addIntegerOption(o=>o.setName('id').setDescription('ID exibido ao cadastrar').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator).setDMPermission(false).toJSON());
  list.push(profileCommand(),...reactionRoleCommands(),...newCommands(),...contextCommands());
  return list;
}

export const embed=(title,description)=>new EmbedBuilder().setColor(gold).setTitle(title).setDescription(description).setFooter({text:'Duckzinha • DuckzinCommunity 🦆💛'});
// As respostas dos comandos slash também funcionam por pedidos explícitos.
export function publicInfoPayload(kind,{site}={}){
  if(kind==='website')return {embeds:[embed('🌐 Conheça o DuckzinCommunity',
    'Oiêê! 💛 Nosso site reúne os projetos da comunidade num lugar só!\n\n'+
    '🧩 **Mods:** criações e novidades do Minecraft.\n'+
    '💻 **Aplicativos:** ferramentas como o DuckCapture.\n'+
    '📂 **Recursos:** arquivos e materiais da comunidade.\n'+
    '⬇️ **Downloads por versão:** abra o projeto, escolha a versão que combina com você e baixe o arquivo disponível.\n'+
    '👤 **Perfis e conta:** acompanhe os recursos do site.\n'+
    '🎫 **Suporte:** pode abrir um ticket quando tiver dificuldades e esperar um atendente.\n\n'+
    `✨ **Acesse:** ${site}\n\n`+
    'Dica: veja as versões e os requisitos antes de instalar um mod!') ]};
  if(kind==='projetos')return {embeds:[embed('📦 Mods, apps e recursos',
    `Aaaa, tem coisa legal no nosso site! ✨\n\n🦆 DuckModels, DuckCapture e outros projetos aparecem no catálogo conforme forem publicados.\n\n🌐 **Veja tudo:** ${site}\n\n⬇️ Clique num projeto e selecione a versão antes de baixar, quando houver mais de uma.`)]};
  return null;
}

export async function runCommand(interaction,{store,site,panelId,localKnowledge,client,clearSession,invalidatePersonality,onVoiceChanged,onVoiceTest,onVoiceJoin,onVoiceLeave,edgeVoiceReady=true}){
  if(!interaction.inGuild()||interaction.guildId!==store.guildId)return;
  const cmd=interaction.commandName;
  const ephemeral=['duckzinha','configurar','ensinar','ensinamentos'].includes(cmd);
  async function respond(payload,privateReply=ephemeral){
    const options=typeof payload==='string'?{content:payload}:payload;
    // As respostas de comandos slash (/website, /ajuda etc.) são permanentes.
    // Não registrar na fila de exclusão das mensagens temporárias do chat.
    return interaction.reply({
      ...options,allowedMentions:{parse:[]},
      ...(privateReply?{flags:MessageFlags.Ephemeral}:{})
    });
  }
  if(cmd==='configurar'){
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
      return respond('Apenas administradores podem configurar minha personalidade.',true);
    if(!store.persistent)return respond('Configure o Supabase para guardar a personalidade.',true);
    const file=interaction.options.getAttachment('arquivo',true);
    if(!file.name?.toLowerCase().endsWith('.txt'))
      return respond('Envie um arquivo .txt de texto simples.',true);
    if(!Number.isSafeInteger(file.size)||file.size<1||file.size>12000)
      return respond('O arquivo precisa ter no máximo 12 KB.',true);
    const url=new URL(file.url);
    if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname))
      return respond('Anexe o TXT diretamente pelo Discord.',true);
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    let prompt;
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw Error('HTTP '+r.status);
      const bytes=await r.arrayBuffer();
      if(bytes.byteLength>12000)throw Error('Arquivo muito grande');
      prompt=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').trim();
    }catch(err){
      return interaction.editReply('Não consegui ler o arquivo TXT em UTF-8. Envie novamente.');
    }
    if(!prompt||prompt.length>8000||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(prompt))
      return interaction.editReply('O prompt precisa ser texto simples e ter até 8 mil caracteres.');
    await store.setPersonalityPrompt(prompt,interaction.user.id);
    invalidatePersonality();
    return interaction.editReply('Personalidade atualizada! O TXT foi salvo no Supabase e continuará ativo depois de reiniciar.');
  }
  if(cmd==='amizade'){
    const count=await store.getFamiliarity(interaction.user.id).catch(()=>0);
    const status=count<5?'a gente está se conhecendo':count<20?'você já é presença conhecida por aqui':'já conversamos bastante por aqui';
    return respond('🦆💛 **Nossa familiaridade**\n'+status+'! Já tivemos **'+count+
      '** conversas registradas em canais públicos.\n\nSe quiser apagar, use `/duckzinha apagar-me`.',true);
  }
  if(cmd==='duckzinha'){
    const sub=interaction.options.getSubcommand();
    if(sub==='entrar'||sub==='sair'){
      const callback=sub==='entrar'?onVoiceJoin:onVoiceLeave;
      if(typeof callback!=='function')return respond('Entrada em call indisponível.',true);
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      try{return interaction.editReply(String(await callback(interaction)).slice(0,1600))}
      catch(error){return interaction.editReply('Não consegui conectar à call: '+
        String(error?.message||error).slice(0,300));}
    }
    if(sub==='testevoz'){
      if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
        return respond('Somente administradores podem testar minha voz.',true);
      if(typeof onVoiceTest!=='function')return respond('Teste de voz indisponível neste momento.',true);
      await interaction.deferReply({flags:MessageFlags.Ephemeral});
      try{
        const result=await onVoiceTest(interaction);
        return interaction.editReply(String(result).slice(0,1600));
      }catch(err){
        return interaction.editReply('Não consegui reproduzir a voz: '+String(err?.message||err).slice(0,350)+
          '. Verifique permissões, libs de áudio e o acesso do host ao Edge TTS.');
      }
    }
    if(sub==='voice'){
      // Não bloquear /apagar-me para membros: permissões são verificadas só neste subcomando.
      if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
        return respond('Só administradores podem alterar minha voz! 🦆💛',true);
      if(!store.persistent)return respond('É necessário configurar o Supabase para salvar a voz.',true);
      const chosen=interaction.options.getString('nome',true);
      if(!validVoice(chosen))return respond('Escolha uma das vozes em português brasileiro da lista.',true);
      await store.setVoice(chosen,interaction.user.id);
      onVoiceChanged?.(chosen);
      return respond('🎙️ Voz selecionada: **'+voiceLabel(chosen)+'**. Salvei sua escolha! '+
        'Os timbres são diferentes quando o Edge TTS funciona. '+
        'Se o Edge falhar, TODAS as opções usam a mesma voz do Google, com ajustes de tom e ritmo. '+
        'Use **/duckzinha testevoz** para descobrir o motor que está tocando.',true);
    }
    if(!store.persistent)return respond('A memória do Supabase não está configurada.',true);
    if(sub==='minhas-memorias'){
      const notes=await store.getProfileFacts(interaction.user.id);
      return respond(notes.length?notes.map(x=>x.fact_value).join('\n'):'Nenhuma preferência salva ainda.',true);
    }
    if(sub==='apagar-me'){
      await store.forgetSelf(interaction.user.id);
      clearSession(interaction.user.id);
      return respond('Seu nome e histórico de conversa foram apagados.',true);
    }
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
      return respond('Apenas administradores podem executar /duckzinha reset.',true);
    await store.resetMemory();
    clearSession();
    return respond('Memória de nomes e conversas apagada. A personalidade e os ensinamentos permanecem salvos.',true);
  }
  if(cmd==='ensinar'||cmd==='ensinamentos'){
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return respond('Esse comando é só da equipe, tá? 💛',true);
    if(!store.persistent)return respond('⚠️ Ative o Supabase para salvar os ensinamentos.',true);
    if(cmd==='ensinar'){
      const topic=interaction.options.getString('assunto',true).toLowerCase().trim();
      const answer=interaction.options.getString('texto',true).trim();
      if(!/^[\p{L}\p{N} _-]{2,50}$/u.test(topic))return respond('Use um assunto simples, sem símbolos estranhos.',true);
      await store.teach(topic,answer);
      void store.awardCoins(interaction.user.id,'ensino:comando:'+interaction.id,'ensino',8,40).catch(()=>{});
      return respond('📚 Aaa, aprendi **'+topic+'**! Agora posso explicar isso quando me mencionarem 💛',true);
    }
    const sub=interaction.options.getSubcommand();
    if(sub==='apagar'){
      const topic=interaction.options.getString('assunto',true).toLowerCase().trim();
      await store.unteach(topic);return respond('🧹 Ensinamento removido: **'+topic+'**.',true);
    }
    const list=await store.loadKnowledge();return respond(list.length?'📚 Assuntos que conheço: '+list.map(x=>'`'+x.topic+'`').join(', ').slice(0,1500):'📭 Ainda não há ensinamentos extras.',true);
  }
  const panel=panelId?`https://discord.com/channels/${interaction.guildId}/${panelId}`:null;
  if(cmd==='ajuda')return respond({embeds:memberHelpEmbeds(embed,interaction.options?.getString?.('categoria')||'todas')});
  if(cmd==='website')return respond(publicInfoPayload('website',{site}));
  if(cmd==='explicarproblema')return respond('🎫 **Guia da Duckzinha para tickets**\n\n'+ticketGuide(),true);
  if(cmd==='ticket')return respond({embeds:[embed('🎫 Precisa de um atendente?',
    'Aii, vamos tentar resolver! 💛\n\n**1.** Entre no canal de tickets do servidor.\n**2.** Escolha a categoria certa.\n**3.** Use `/explicarproblema` para ver um guia de atendimento.\n**4.** Aguarde alguém da equipe atender; não é preciso mencionar toda a staff.\n\n'+
    (panel?`🔗 **Abrir o painel:** ${panel}`:'📌 Procure o canal de abrir tickets no servidor.')+
    '\n\n🔒 Seu atendimento é privado para você e a equipe autorizada. Eu não leio nem respondo dentro do ticket.') ]});
  if(cmd==='projetos')return respond(publicInfoPayload('projetos',{site}));
  if(cmd==='boxpvp')return showBoxPvp(interaction,{store,panelId});
  if(cmd==='boxpvpadmin')return manageBoxPvp(interaction,{store});
  if(cmd==='faq')return respond({embeds:[embed('❓ Perguntinhas frequentes',
    `**Como baixar?** Entre em ${site}, abra um projeto e escolha a versão disponível.\n\n**Meu download não funciona!** Abra um ticket e aguarde um atendente humano.\n\n**Como falo com você?** Me mencione no servidor: \`@Duckzinha oi!\`.\n\n**Você lembra das pessoas?** Guardo um histórico curto de conversa, e você pode apagar com \`/duckzinha apagar-me\`!`)]});
  if(cmd==='sobre')return respond({embeds:[embed('🦆 Oiee, eu sou a Duckzinha!',
    'Sou a ajudante virtual do DuckzinCommunity! 💛 Gosto de explicar as coisas com calma, usar uns emojis e conhecer os gostos de jogos do pessoal. KKKKK ✨\n\nNão sou parte da equipe humana de suporte, mas posso te encaminhar ao painel de tickets!') ]});
  if(cmd==='ping')return respond('🏓 Pong! Minha conexão com o Discord está em **'+Math.max(0,Math.round(client.ws.ping))+'ms**. Tô vivinha aqui! 🦆💛');
}
