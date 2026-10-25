// Catálogo de comandos que membros comuns podem usar.
// Não incluir comandos de administração, mesmo quando têm subcomandos mistos.
export const MEMBER_HELP_SECTIONS=Object.freeze([
 {title:'🌐 Informações e suporte',commands:[
  ['/ajuda','Mostra todos os comandos para membros.'],
  ['/website','Abre as informações do site da comunidade.'],
  ['/projetos','Lista os projetos e onde encontrá-los.'],
  ['/novidades','Consulta as atualizações publicadas.'],
  ['/boxpvp','Lista IPs de servidores BoxPvP aprovados. Peça cadastro por ticket.'],
  ['/ticket','Mostra como abrir um atendimento.'],
  ['/explicarproblema','Ajuda a descrever bugs ou dúvidas num ticket.'],
  ['/faq','Respostas às dúvidas mais comuns.'],
  ['/sobre','Conheça a Duckzinha.'],
  ['/ping','Consulta a conexão da bot.']
 ]},
 {title:'🦆 Perfil, amizade e voz',commands:[
  ['/avatar','Abra o Studio para personalizar seu pato.'],
  ['/ver pessoa','Veja o avatar de alguém (ou o seu).'],
  ['/perfil','Mostra o perfil e a sequência de quiz.'],
  ['/card','Gera o cartão visual de um membro.'],
  ['/inventario','Exibe seus cinco conjuntos cosméticos.'],
  ['/amizade','Mostra quantas vezes já conversou com a Duckzinha.'],
  ['/duckzinha minhas-memorias','Veja as preferências que salvou.'],
  ['/duckzinha apagar-me','Apaga seus dados pessoais da memória da bot.'],
  ['/duckzinha entrar','Convida a Duckzinha para sua call, se ela tiver acesso.'],
  ['/duckzinha sair','Pede que ela saia da sua call.'],
  ['/testarreacao','Testa uma reação no chat.'],
  ['/reacao','Envia uma reação ilustrada.']
 ]},
 {title:'🎮 Minigames e moedas',commands:[
  ['/jogo quiz','Inicia quiz público por rodadas.'],
  ['/campeonato iniciar','Começa campeonato de perguntas.'],
  ['/minigame','Escolhe quiz, anime, mob/bloco, emoji, matemática, Jogo da Velha, Pedra-Papel-Tesoura ou Quiz Streak.'],
  ['/coinflip','Desafia alguém em cara ou coroa, sem apostas.'],
  ['/moedas','Consulta seu saldo de moedas de pato.'],
  ['/enviar','Transfere moedas virtuais a outro membro.'],
  ['/afk iniciar','Começa sua sessão AFK.'],
  ['/afk resgatar','Recebe a recompensa AFK quando disponível.'],
  ['/emblema loja','Consulta emblemas e cargos disponíveis.']
 ]},
 {title:'💡 Comunidade e organização',commands:[
  ['/lembrete criar','Agenda um lembrete pessoal por DM.'],
  ['/lembrete listar','Consulta seus lembretes.'],
  ['/lembrete cancelar','Cancela um lembrete pelo ID.'],
  ['/resumo','Resumo de um canal público.'],
  ['/sugerir','Envia uma sugestão pública para votação.'],
  ['/evento listar','Mostra os próximos eventos da comunidade.']
 ]}
]);
export function memberHelpEmbeds(embed){
 const entries=MEMBER_HELP_SECTIONS.map(section=>embed(section.title,
  section.commands.map(([command,description])=>
   '**'+command+'** — '+description).join('\n')));
 entries[0].setDescription(entries[0].data.description+
  '\n\n💬 Converse comigo mencionando `@Duckzinha` em um canal público.');
 entries[entries.length-1].setDescription(entries.at(-1).data.description+
  '\n\n🎁 O painel diário tem um botão para resgatar 20 moedas.\n'+
  '📩 Quer cadastrar um IP BoxPvP? Abra um ticket. Só a administração aprova.\n'+
  '🖱️ No menu de contexto de mensagens também há **Explicar, Resumir, Traduzir e Pesquisar**.');
 return entries;
}
