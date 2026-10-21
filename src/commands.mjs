import {EmbedBuilder,MessageFlags,PermissionFlagsBits,SlashCommandBuilder} from 'discord.js';

const gold=0xf7d65b;
const choice=[
  ['ajuda','Veja tudo que a Duckzinha pode fazer'],
  ['website','Conheça nosso site e como ele funciona'],
  ['ticket','Saiba onde abrir um ticket'],
  ['projetos','Mods, apps e downloads da comunidade'],
  ['boxpvp','Entenda o que é BoxPvP'],
  ['faq','Perguntas frequentes'],
  ['sobre','Quem é a Duckzinha'],
  ['ping','Confira se estou online']
];

export function commandPayloads(){
  const list=choice.map(([name,description])=>new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('memoria').setDescription('Controle o que a Duckzinha lembra de você')
    .addSubcommand(s=>s.setName('ativar').setDescription('Autorizar lembrar seu nome quando você se apresentar'))
    .addSubcommand(s=>s.setName('ver').setDescription('Ver o nome que ela guardou sobre você'))
    .addSubcommand(s=>s.setName('apagar').setDescription('Apagar seus dados da memória e desativar'))
    .toJSON());
  list.push(new SlashCommandBuilder().setName('ensinar').setDescription('Ensinar um assunto à Duckzinha (admin)')
    .addStringOption(o=>o.setName('assunto').setDescription('Palavra-chave, exemplo boxpvp').setRequired(true).setMaxLength(50))
    .addStringOption(o=>o.setName('texto').setDescription('Explicação que ela poderá usar').setRequired(true).setMaxLength(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false).toJSON());
  list.push(new SlashCommandBuilder().setName('ensinamentos').setDescription('Ver ou apagar conhecimentos ensinados (admin)')
    .addSubcommand(s=>s.setName('listar').setDescription('Listar assuntos que foram ensinados'))
    .addSubcommand(s=>s.setName('apagar').setDescription('Apagar um assunto da memória da comunidade')
      .addStringOption(o=>o.setName('assunto').setDescription('Nome do assunto').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false).toJSON());
  return list;
}

export const embed=(title,description)=>new EmbedBuilder().setColor(gold).setTitle(title).setDescription(description).setFooter({text:'Duckzinha • DuckzinCommunity 🦆💛'});
export async function runCommand(interaction,{store,site,panelId,schedule,localKnowledge,client}){
  if(!interaction.inGuild()||interaction.guildId!==store.guildId)return;
  const cmd=interaction.commandName;
  const ephemeral=cmd==='memoria'||cmd==='ensinar'||cmd==='ensinamentos';
  async function respond(payload,privateReply=ephemeral){
    const options=typeof payload==='string'?{content:payload}:payload;
    const sent=await interaction.reply({...options,allowedMentions:{parse:[]},...(privateReply?{flags:MessageFlags.Ephemeral}:{withResponse:true})});
    if(!privateReply){
      const message=sent?.resource?.message || await interaction.fetchReply().catch(()=>null);
      if(message)void schedule(message);
    }
  }
  if(cmd==='memoria'){
    const sub=interaction.options.getSubcommand();
    if(!store.persistent)return respond('🔒 A memória ainda não foi ligada no Supabase. Os comandos de conversa continuam funcionando!');
    if(sub==='ativar'){
      await store.setMemoryEnabled(interaction.user.id,true);
      return respond('💛 Prontinho! Agora, quando você **me mencionar e disser seu nome**, posso lembrar dele em outras conversas. Use `/memoria apagar` quando quiser remover tudo. Não guardo as conversas inteiras.');
    }
    if(sub==='apagar'){
      await store.forget(interaction.user.id);
      return respond('🧹 Tudo que eu tinha guardado sobre você foi apagado! Prometidinho 💛');
    }
    const row=await store.getMember(interaction.user.id);
    return respond(row?.enabled?`🦆 Sua memória está ativada. Nome guardado: **${row.preferred_name||'nenhum ainda'}**. Para apagar: \`/memoria apagar\`.`:'💛 Sua memória está desativada. Nada foi guardado.');
  }
  if(cmd==='ensinar'||cmd==='ensinamentos'){
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return respond('Esse comando é só da equipe, tá? 💛',true);
    if(!store.persistent)return respond('⚠️ Ative o Supabase para salvar os ensinamentos.',true);
    if(cmd==='ensinar'){
      const topic=interaction.options.getString('assunto',true).toLowerCase().trim();
      const answer=interaction.options.getString('texto',true).trim();
      if(!/^[\p{L}\p{N} _-]{2,50}$/u.test(topic))return respond('Use um assunto simples, sem símbolos estranhos.',true);
      await store.teach(topic,answer);return respond('📚 Aaa, aprendi **'+topic+'**! Agora posso explicar isso quando me mencionarem 💛',true);
    }
    const sub=interaction.options.getSubcommand();
    if(sub==='apagar'){
      const topic=interaction.options.getString('assunto',true).toLowerCase().trim();
      await store.unteach(topic);return respond('🧹 Ensinamento removido: **'+topic+'**.',true);
    }
    const list=await store.loadKnowledge();return respond(list.length?'📚 Assuntos que conheço: '+list.map(x=>'`'+x.topic+'`').join(', ').slice(0,1500):'📭 Ainda não há ensinamentos extras.',true);
  }
  const panel=panelId?`https://discord.com/channels/${interaction.guildId}/${panelId}`:null;
  if(cmd==='ajuda')return respond({embeds:[embed('🦆 Central de ajuda da Duckzinha',
    'Oiee, patinho! 💛 Eu sou a ajudante da comunidade!\n\n'+
    '🌐 **/website** — conhecer nosso site\n🎫 **/ticket** — atendimento humano\n📦 **/projetos** — mods, apps e arquivos\n🎮 **/boxpvp** — modo de jogo e gírias\n❓ **/faq** — dúvidas comuns\n💛 **/sobre** — saber mais sobre mim\n🏓 **/ping** — estou online?\n🧠 **/memoria** — controle sua memória\n\n'+
    '💬 **Para conversar comigo**, escreva `@Duckzinha` e sua pergunta. Só respondo quando sou mencionada!\n\n'+
    '⚠️ Para bugs e problemas de verdade, abra um ticket e aguarde a equipe.') ]});
  if(cmd==='website')return respond({embeds:[embed('🌐 Conheça o DuckzinCommunity',
    'Oiêê! 💛 Nosso site reúne os projetos da comunidade num lugar só!\n\n'+
    '🧩 **Mods:** criações e novidades do Minecraft.\n'+
    '💻 **Aplicativos:** ferramentas como o DuckCapture.\n'+
    '📂 **Recursos:** arquivos e materiais da comunidade.\n'+
    '⬇️ **Downloads por versão:** abra o projeto, escolha a versão que combina com você e baixe o arquivo disponível.\n'+
    '👤 **Perfis e conta:** acompanhe os recursos do site.\n'+
    '🎫 **Suporte:** pode abrir um ticket quando tiver dificuldades e esperar um atendente.\n\n'+
    `✨ **Acesse:** ${site}\n\n`+
    'Dica: veja as versões e os requisitos antes de instalar um mod!') ]});
  if(cmd==='ticket')return respond({embeds:[embed('🎫 Precisa de um atendente?',
    'Aii, vamos tentar resolver! 💛\n\n**1.** Entre no canal de tickets do servidor.\n**2.** Escolha a categoria certa.\n**3.** Explique seu problema com calma.\n**4.** Aguarde alguém da equipe atender; não é preciso mencionar toda a staff.\n\n'+
    (panel?`🔗 **Abrir o painel:** ${panel}`:'📌 Procure o canal de abrir tickets no servidor.')+
    '\n\n🔒 Seu atendimento é privado para você e a equipe autorizada. Eu não leio nem respondo dentro do ticket.') ]});
  if(cmd==='projetos')return respond({embeds:[embed('📦 Mods, apps e recursos',
    `Aaaa, tem coisa legal no nosso site! ✨\n\n🦆 DuckModels, DuckCapture e outros projetos aparecem no catálogo conforme forem publicados.\n\n🌐 **Veja tudo:** ${site}\n\n⬇️ Clique num projeto e selecione a versão antes de baixar, quando houver mais de uma.`)]});
  if(cmd==='boxpvp')return respond({embeds:[embed('🎮 BoxPvP? W demais!',
    'BoxPvP é um PvP de Minecraft com mapas em caixas, minas de vários temas, kits muito fortes, elytras e até jaulas de vidro em alguns servidores!\n\n💛 Na comunidade, **W** pode ser uma reação de admiração e **GG** pode significar um bom jogo.\n\nExemplos de servidores conhecidos por essa comunidade: BawMC e RaizuMC. As regras podem mudar em cada servidor!') ]});
  if(cmd==='faq')return respond({embeds:[embed('❓ Perguntinhas frequentes',
    `**Como baixar?** Entre em ${site}, abra um projeto e escolha a versão disponível.\n\n**Meu download não funciona!** Abra um ticket e aguarde um atendente humano.\n\n**Como falo com você?** Me mencione no servidor: \`@Duckzinha oi!\`.\n\n**Você lembra das pessoas?** Só guardo seu nome se você ativar em \`/memoria ativar\`, e você pode apagar quando quiser!`)]});
  if(cmd==='sobre')return respond({embeds:[embed('🦆 Oiee, eu sou a Duckzinha!',
    'Sou a ajudante virtual do DuckzinCommunity! 💛 Gosto de explicar as coisas com calma, usar uns emojis e conhecer os gostos de jogos do pessoal. KKKKK ✨\n\nNão sou parte da equipe humana de suporte, mas posso te encaminhar ao painel de tickets!') ]});
  if(cmd==='ping')return respond('🏓 Pong! Minha conexão com o Discord está em **'+Math.max(0,Math.round(client.ws.ping))+'ms**. Tô vivinha aqui! 🦆💛');
}
