// Catálogo dos comandos disponíveis para membros da DuckzinCommunity.
// Se um comando novo for registrado, o teste de cobertura deve exigir sua documentação.
// Subcomandos de administração e moderação não aparecem aqui.
export const MEMBER_HELP_SECTIONS=Object.freeze([
 {title:'🌐 Informações e suporte',commands:[
  ['/ajuda','Exibe este guia completo com todos os comandos de membros.'],
  ['/website','Mostra o endereço do site e como usar os projetos.'],
  ['/projetos','Mostra o catálogo de mods, aplicativos e downloads.'],
  ['/novidades','Consulta as últimas atualizações de projetos.'],
  ['/boxpvp','Lista IPs BoxPvP aprovados; novos cadastros são solicitados por ticket.'],
  ['/ticket','Ensina onde abrir um atendimento com a equipe.'],
  ['/explicarproblema','Ajuda a descrever um problema em um ticket.'],
  ['/faq','Responde perguntas frequentes da comunidade.'],
  ['/sobre','Apresenta a Duckzinha e suas funções.'],
  ['/ping','Confere se a Duckzinha está respondendo.']
 ]},
 {title:'🦆 Perfil, amizade e voz',commands:[
  ['/avatar','Abre o Studio para personalizar seu pato e salvar visuais.'],
  ['/ver pessoa','Mostra o avatar seu ou de outro membro.'],
  ['/perfil','Mostra avatar, recorde e sequência de quiz.'],
  ['/card','Gera um cartão do membro com avatar e moedas.'],
  ['/inventario','Consulta os cinco visuais cosméticos salvos.'],
  ['/amizade','Consulta a familiaridade das suas conversas públicas com ela.'],
  ['/duckzinha minhas-memorias','Mostra o que a Duckzinha guardou sobre você.'],
  ['/duckzinha apagar-me','Solicita a exclusão dos seus dados na memória da bot.'],
  ['/duckzinha entrar','Convida a bot para a sua call, até privada se tiver permissão.'],
  ['/duckzinha sair','Faz a bot sair da sua call.'],
  ['/testarreacao','Testa um emoji e as permissões de reação no canal público.'],
  ['/reacao','Envia uma reação ilustrada da Duckzinha.']
 ]},
 {title:'🎮 Jogos e economia',commands:[
  ['/jogo quiz','Quiz público com cinco níveis e perguntas em sequência.'],
  ['/campeonato iniciar','Campeonato público; só quem acerta avança de rodada.'],
  ['/minigame','Escolha entre quiz, desafios de pistas, anime, mobs, blocos, emojis, lógica, matemática, Pedra-Papel-Tesoura, Jogo da Velha e Quiz Streak.'],
  ['/coinflip','Desafia outro membro em três rodadas de cara ou coroa, sem apostas.'],
  ['/moedas','Consulta seu saldo de moedas de pato.'],
  ['/enviar','Envia de 1 a 500 moedas para outro membro.'],
  ['/afk','Escolha a ação `iniciar` ou `resgatar` para as recompensas AFK.'],
  ['/emblema loja','Consulta os emblemas disponíveis para comprar com moedas.']
 ]},
 {title:'💡 Comunidade e lembretes',commands:[
  ['/lembrete criar','Agenda um aviso pessoal por DM: texto + duração (ex.: 15m ou 2h).'],
  ['/lembrete listar','Mostra os próximos lembretes agendados.'],
  ['/lembrete cancelar','Cancela um lembrete pelo ID.'],
  ['/resumo','Resume as mensagens recentes do canal público atual.'],
  ['/sugerir','Envia uma ideia pública para votação da comunidade.'],
  ['/evento listar','Mostra os próximos eventos agendados.']
 ]}
]);
// Valores compartilhados com o seletor de /ajuda. O padrão continua exibindo tudo.
export const MEMBER_HELP_CATEGORIES=Object.freeze([
 {name:'Todos os comandos',value:'todas'},
 {name:'Informações e suporte',value:'informacoes'},
 {name:'Perfil, amizade e voz',value:'perfil'},
 {name:'Jogos e moedas',value:'jogos'},
 {name:'Comunidade e lembretes',value:'comunidade'}
]);
const CATEGORY_IDS=['informacoes','perfil','jogos','comunidade'];
export const MEMBER_HELP_COMMANDS=Object.freeze(
 MEMBER_HELP_SECTIONS.flatMap(s=>s.commands.map(([command])=>command))
);
export function memberHelpEmbeds(embed,category='todas'){
 const index=CATEGORY_IDS.indexOf(category);
 const sections=index>=0?[MEMBER_HELP_SECTIONS[index]]:MEMBER_HELP_SECTIONS;
 const entries=sections.map(section=>embed(section.title,
  section.commands.map(([command,description])=>
   '**'+command+'** — '+description).join('\n')));
 const count=sections.reduce((n,section)=>n+section.commands.length,0);
 entries[0].setDescription(
  '📖 **Guia para membros • '+count+' comandos e opções**\n'+
  (category==='todas'
    ?'Mostro todos os comandos que membros podem usar, sem ações restritas à equipe.'
    :'Categoria selecionada. Use `/ajuda` sem filtro para ver todos os comandos.')+
  '\n\n'+entries[0].data.description+
  '\n\n💬 Para conversar, marque `@Duckzinha` em um canal público. '+
  'Ela acompanha o contexto recente, mas não lê tickets ou DMs de outras pessoas.'
 );
 const gamesIndex=sections.findIndex(x=>x===MEMBER_HELP_SECTIONS[2]);
 if(gamesIndex>=0){
  entries[gamesIndex].setDescription(entries[gamesIndex].data.description+
   '\n\n🧩 **Modos do /minigame:** aleatório, verdadeiro/falso, anime, '+
   'adivinhe personagem, mob ou bloco, Minecraft, geografia, matemática, '+
   'emojis, lógica, Jogo da Velha, Pedra-Papel-Tesoura e Quiz Streak.\n'+
   '🏆 **Recompensas:** +5 moedas por vitória ou acerto nos minigames; '+
   'Coinflip: 15 moedas ao vencedor. Sem apostas. '+
   'O Jogo da Velha limita a cinco vitórias premiadas a cada duas horas.\n'+
   '🔒 Ela não revela respostas enquanto uma rodada de quiz estiver ativa.'
  );
 }
 const communityIndex=sections.findIndex(x=>x===MEMBER_HELP_SECTIONS[3]);
 if(communityIndex>=0){
  entries[communityIndex].setDescription(entries[communityIndex].data.description+
   '\n\n🎁 **Diário:** resgate 20 moedas pelo botão do painel publicado pela equipe.\n'+
   '🏷️ **Emblemas:** a equipe publica a loja; membros usam os botões para comprar.\n'+
   '🖱️ **Menu de mensagem:** clique com o botão direito em uma mensagem para '+
   'Explicar, Resumir, Traduzir ou Pesquisar.\n'+
   '📩 Banimentos e avisos podem chegar por DM se a pessoa permitir mensagens privadas.'
  );
 }
 return entries;
}
