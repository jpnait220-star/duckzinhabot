# 🦆 Duckzinha — Assistente do DuckzinCommunity (versão 1)

Bot **separado** do Duckzin Bridge. Escrito em Node.js 22 + discord.js 14. Ele **apenas publica avisos em novos tickets** (quando configurado) e não altera tickets, não consulta canais privados de suporte para gerar respostas de IA, não se passa por humano e não exige chave de IA para iniciar.

## O que já faz

- Responde normalmente quando **mencionada diretamente** `@Duckzinha` no servidor. Exceção: confirma pedidos explícitos de memória feitos em canais públicos; não responde a DMs.
- Personalidade simpática, educada, simples, com emojis, GG/W/KKKK quando combinar.
- `/ajuda`, `/website`, `/ticket`, `/explicarproblema`, `/projetos`, `/boxpvp`, `/faq`, `/sobre`, `/ping`.
- `/testarreacao tipo:ola` — diagnóstico privado do emoji, das permissões e teste real na sua última mensagem pública (envie um `oi` antes).
- **Pedidos por mensagem:** ao mencionar `@Duckzinha` em um canal público, ela interpreta frases como `qual site do duckzin?` e `quais projetos?` e responde com o **mesmo embed** dos comandos `/website` e `/projetos`, sem apagar a resposta.
- **Duckzinha fala na call ao ser mencionada no chat de voz:** se o membro estiver no canal de voz e escrever `@Duckzinha oi!` no chat dessa call, ela entra **sem ouvir nem gravar áudio de outras pessoas**, responde por texto e **fala a resposta na call** por meio do Edge TTS, quando o serviço online estiver disponível. Só funciona em calls públicas em que tem **Ver canal, Conectar, Falar, Enviar mensagens**. Não responde a menções de pessoas fora da call. Cada nova menção renova o temporizador de **5 minutos**; sem novas menções, ela sai. Só ocupa uma call por servidor.
- **TTS Bot alternativo:** com o Edge TTS ativo, a Duckzinha já fala por conta própria; **não use TTS Bot para ler suas mensagens ao mesmo tempo**, pois duplicaria a voz. Se o Edge TTS estiver indisponível, ela permanece em modo texto e você ainda pode usar o TTS Bot com `/set botignore False` e `/join` (dependendo das configurações do TTS Bot).
- **Comando de administrador `/duckzinha voice nome`:** escolha entre 11 opções: cinco vozes-base em português (Francisca, Thalita, Antônio, Raquel e Duarte) e seis estilos derivados de tom e velocidade. Raquel e Duarte falam português de Portugal. As escolhas são salvas no Supabase; `/duckzinha apagar-me` continua disponível aos membros.
- **Teste de áudio:** o administrador entra na call e executa `/duckzinha testevoz`. O bot tenta sintetizar a fala via Edge TTS e reproduzi-la na call, mostrando os erros encontrados. A própria Duckzinha também informa falhas de voz no chat, sem exigir novas variáveis de ambiente.
- **Como ativar a voz na FadeHost:** a Duckzinha usa **Edge TTS online**, sem chave de API, cartão, conta Azure ou região. Basta atualizar o código, instalar as dependências (`npm install`) e redeployar. A seleção fica salva em `duckzinha_config.voice_name` no Supabase (migração aplicada). É uma integração comunitária **não oficial**, exige internet e pode ficar indisponível se o serviço mudar. Não há garantia de disponibilidade.
- **Reprodução:** usa áudio WebM/Opus gerado pelo Edge, com respostas de até 420 caracteres. A Duckzinha não processa, escuta nem grava o som dos membros da call; precisa de permissão **Falar**. Não use o TTS Bot para reproduzir as mesmas mensagens ao mesmo tempo.
- **Biblioteca de voz:** o projeto usa `@discordjs/voice@0.19.2`, requer **Node.js 22.12 ou superior** (preferencialmente Node 24 LTS na hospedagem) e o intent `GuildVoiceStates`. Após publicar o código, a hospedagem precisa reinstalar as dependências.
- **Música no chat da call:** `@Duckzinha coloca a música Faded na call` publica `m!p faded` **no chat do canal de voz onde o solicitante estiver**, se a Duckzinha tiver acesso ao canal. Se não estiver em uma call, pede para entrar primeiro.
- **TTS Bot opcional:** pedir `@Duckzinha faz -join do tts` ainda envia `-join` ao chat da call, mas outros bots podem ignorar esse comando. A Duckzinha agora pode falar diretamente via Edge TTS, sem depender disso.
- **Limitação do Discord:** a Duckzinha não consegue invocar um slash command de outro bot. Música e TTS são comandos de **texto**, e vários bots ignoram mensagens enviadas por outros bots; portanto a Duckzinha **confirma somente o envio ao chat**, nunca garante que o bot de música/TTS executou o comando. A alternativa, se ignorarem, é digitar manualmente o comando ou integrar a API oficial daquele bot.
- **Permissões para ações:** `GuildVoiceStates` habilitado no aplicativo e permissões **Ver canal** e **Enviar mensagens** para a Duckzinha no chat das calls. As ações só são acionadas por menção direta, respeitando cooldown e não usam tickets nem canais da equipe.

- **Conversa coletiva em canais públicos:** lê mensagens normais de canais públicos para manter em RAM até 100 mensagens recentes (máximo de 48 horas), inclusive entre canais públicos, sem persistir esse chat completo. Ao ser mencionada, também consulta mensagens recentes do canal. Nunca inclui tickets, DMs, canais privados ou canais da equipe nessa memória coletiva. A RAM é apagada ao reiniciar.
- **Boas-vindas automáticas:** com `WELCOME_CHANNEL_ID` definido na FadeHost e **Server Members Intent** ativado no Discord Developer Portal, a Duckzinha cumprimenta os novos membros no canal de entrada. Ela não faz menção a cargos nem envia DMs.
- **Guia para tickets antigos e novos:** `/explicarproblema` funciona no servidor (inclusive dentro de tickets antigos) e mostra em privado como detalhar o problema sem divulgar informações sensíveis. Tickets novos também recebem o botão **Como explicar meu problema** na mensagem da Duckzinha.
- **Aviso em tickets recém-criados:** quando um bot de tickets cria um **canal de texto privado** em `TICKET_CATEGORY_ID`, a Duckzinha avisa para aguardar a staff. Sem essa variável, ela só reconhece canais privados com prefixos `ticket-`, `tickets-` ou `atendimento-` (ou usando `_`). A bot precisa ter acesso e permissão de enviar mensagens nesse canal. Não interfere na criação ou fechamento de tickets, nem lê o conteúdo para esse aviso. A mensagem de espera não é apagada automaticamente.
- **Continuidade de conversa:** até 12 mensagens por usuário, armazenadas no Supabase por até 14 dias. Agora o histórico pessoal é enviado **junto** com as mensagens recentes do canal, em vez de ser descartado. Perguntas curtas como `e o jogo?`, `e o filme?` ou `e a história?` retomam explicitamente o último assunto da mesma pessoa, quando houver histórico.
- **Memória permanente com consentimento:** em canal público, cada membro pode dizer `lembra que meu jogo favorito é Minecraft`, `lembra que minha cor favorita é amarelo`, `lembra que eu gosto de jogar Minecraft` etc. A preferência fica na tabela `duckzinha_profile_facts`, sem prazo de expiração, até o membro apagá-la. O bot só mostra **🧠 Memória atualizada!** se a gravação for confirmada no banco. Afirmações comuns e sobre terceiros não viram fatos pessoais permanentes.
- **Memória oficial do servidor:** membros com permissão **Gerenciar servidor** podem dizer em canal público `lembra que o servidor tem modo survival` para guardar um fato no conhecimento coletivo. Não é necessário mencionar a Duckzinha quando se pede para lembrar.
- **Controle da memória:** `/duckzinha minhas-memorias` mostra ao próprio membro suas preferências, de modo privado; `/duckzinha apagar-me` remove histórico curto, nome e preferências pessoais; `/duckzinha reset` faz a limpeza da memória pessoal de todos os membros (administradores). Informações oficiais da comunidade são gerenciadas em `/ensinamentos`.
- **Continuidade depois de pesquisar:** sempre que Tavily ou Serper devolvem resultados e a Duckzinha responde, o bot registra no histórico pessoal a pergunta, a resposta e um resumo curto das páginas consultadas — inclusive quando a busca partiu do botão **Pesquisar** ou a IA precisou de resposta básica. As próximas perguntas recebem esse resumo para não sugerir uma nova pesquisa sobre o que já foi explicado. Essa memória de pesquisa é **histórico temporário de conversa** (até 12 mensagens, 14 dias), não um ensinamento permanente do servidor. Se a nova pergunta exigir detalhes ausentes nas fontes anteriores, ela poderá oferecer outra pesquisa.
- **Brincadeiras compartilhadas:** mensagens engraçadas recentes podem ser retomadas pelo histórico habitual; cada membro também pode pedir explicitamente `lembra que meu bordão é pato rei` ou `lembra que minha piada favorita é pato ninja`, guardando só sua própria preferência.
- **Familiaridade sem ranking público:** a Duckzinha reconhece se um membro já conversou algumas vezes com ela. O indicador é uma contagem simples de respostas ao mencionar a bot em canal público, guardada na tabela protegida `duckzinha_familiarity`; não cria relações exclusivas nem mede quem é melhor. `/amizade` mostra a informação privadamente. `/duckzinha apagar-me` também exclui essa contagem.
- **Emojis personalizados como reações:** a Duckzinha reage **na própria mensagem** quando reconhece `oi`, `olá`, `bom dia`, risadas, GG, fofura e surpresa — **inclusive se a mensagem mencionar @Duckzinha**. Procura no servidor os emojis `duckzinha_ola`, `duckzinha_riso`, `duckzinha_fofo`, `duckzinha_gg`, `duckzinha_surpresa`. Alternativamente configure `DUCK_EMOJI_OLA`, `DUCK_EMOJI_RISO`, `DUCK_EMOJI_FOFO`, `DUCK_EMOJI_GG`, `DUCK_EMOJI_SURPRESA` na FadeHost com os IDs dos emojis. Saudações como `ola`, `olááá`, `oiii`, `eae`, `bom dia` e `oioi` são reconhecidas com ou sem acento, maiúsculas e pontuação. Quando uma frase pública curta e não sensível não corresponder às regras locais, o Workers AI configurado pode interpretá-la como cumprimento, riso, fofura, GG ou surpresa (com limite de consultas). Saudações respeitam no mínimo 8 segundos no servidor, 12 segundos no canal e 20 segundos por membro; outras categorias têm chance de 50% e intervalos maiores para evitar spam. Permissões: **Ver canal**, **Ler histórico de mensagens** e **Adicionar reações**. Nunca reage em tickets ou canais privados. **`/testarreacao`** testa imediatamente o emoji escolhido na última mensagem recente do autor e mostra o que estiver faltando, independentemente do intervalo antispam. Nas boas-vindas o bot continua enviando `ola.webp` como anexo.
- **Orientação adicional em tickets:** ao criar um canal de ticket privado, a Duckzinha mostra o botão **Como explicar meu problema**. Ao clicar, só o membro vê orientações para contar o erro, versão e o que já tentou, sem divulgar senhas nem dados pessoais.
- **Pesquisa na web com botões:** quando não tem certeza sobre uma pergunta factual (ex.: "o que é MushMC?"), a Duckzinha oferece os botões **Eu explico** e **Pesquisar**. O primeiro deixa o autor explicar no chat, sem gravar aquilo automaticamente como conhecimento oficial do servidor. O segundo consulta Tavily e, se necessário, Serper. Depois de pesquisar, mostra **Ver fontes**; cada pessoa pode clicar para visualizar os links em uma resposta privada do Discord. Os botões são temporários e não sobrevivem totalmente a reinicializações da hospedagem. A busca direta por mensagem continua disponível. Apenas fontes que o buscador efetivamente retornou são exibidas.
- `/duckzinha apagar-me`: cada membro pode excluir histórico e nome. `/duckzinha reset`: exclusivo para administradores, apaga a memória dos membros.
- `/configurar arquivo:<arquivo.txt>`: administradores podem enviar um TXT UTF-8 com a personalidade e o comportamento desejado (até 8.000 caracteres). O texto fica salvo no Supabase e é aplicado às próximas respostas.

- `/ensinar` e `/ensinamentos`: administradores configuram assuntos sem editar o código (com Supabase ativo).
- **Respostas de comandos slash são permanentes:** `/website`, `/ajuda`, `/projetos`, `/ticket`, `/faq`, `/sobre`, `/boxpvp`, `/ping` etc. ficam no canal, sem agendamento de exclusão. Os comandos que respondem privadamente continuam efêmeros conforme o Discord.
- **Respostas normais de conversa** (ao mencionar a Duckzinha) continuam sendo apagadas após **20 minutos**, apenas as mensagens dela; o agendamento pode persistir após reinício se o Supabase estiver configurado. Mensagens de comandos antigas já agendadas antes desta correção ainda podem expirar.
- IA opcional **Cloudflare Workers AI: `@cf/google/gemma-4-26b-a4b-it`**; fallback para respostas básicas quando não houver configuração, o serviço falhar ou atingir a cota. As mensagens enviadas à IA podem incluir falas recentes de outros membros do mesmo canal público quando a bot é mencionada, para que participe do contexto coletivo.

## Configurar entrada e tickets na FadeHost

- `WELCOME_CHANNEL_ID` = ID numérico do **canal de boas-vindas/entrada**. Essa variável ativa o evento de entrada dos membros. Habilite **Server Members Intent (Guild Members)** em **Discord Developer Portal → Bot → Privileged Gateway Intents** antes de reiniciar o bot; sem isso, o Discord pode desconectá-lo com o erro 4014.
- `TICKET_CATEGORY_ID` = ID numérico da **categoria do Discord** onde o bot de tickets cria os canais privados. Recomendado para não confundir com outros canais. Se o bot de tickets usa threads em vez de canais, o aviso de abertura por canal não se aplica.
- Na lista de membros/cargos autorizados da categoria de tickets, inclua a Duckzinha com **Ver canal**, **Enviar mensagens** e **Ler histórico de mensagens**, ou conceda acesso ao cargo do bot. O bot não solicita permissões de administrador.

Para copiar um ID no Discord, ative **Modo desenvolvedor** em Configurações avançadas, clique com o botão direito no canal/categoria e use **Copiar ID**. Nunca copie uma chave de API nesses campos.

## Antes de executar

1. Crie um **novo aplicativo/bot** no Discord Developer Portal: não use o token do Duckzin Bridge. Ative **Message Content Intent** nas configurações de Bot (caso permitido/necessário). Para boas-vindas, também ative **Server Members Intent**. Nas permissões, conceda **View Channels, Send Messages, Embed Links, Read Message History, Add Reactions** e o escopo `applications.commands` ao instalar. Para a imagem das boas-vindas, conceda também **Attach Files** no canal de entrada.
2. Faça uma cópia de `.env.example` para `.env`, preencha os IDs do **novo bot** e o ID do servidor. **Não publique `.env`, chaves ou tokens**, nem mesmo no GitHub privado.
3. Instale Node.js 22. Rode `npm install` e `npm start`. Com apenas as variáveis Discord, já funcionam os comandos e as respostas básicas.
4. Para **memória persistente e aprendizado**, abra `sql/schema.sql`, execute no Supabase sob responsabilidade do administrador, e configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **somente na hospedagem**, nunca no site.
5. Para IA, quem atende aos requisitos do provedor pode configurar a conta/serviço e definir `CF_ACCOUNT_ID` e `CF_API_TOKEN` diretamente no Railway. Não é preciso compartilhar a chave no chat. O modelo e o endpoint podem ser alterados no `.env`.

## Railway (24/7)

Crie um **novo repositório privado** só para a Duckzinha. Publique os arquivos deste ZIP (exceto `.env` e `node_modules`). No Railway, crie um serviço separado pelo GitHub, Node 22, comando de inicialização `npm start`, **uma única réplica**. Em **Variables**, copie os nomes de `.env.example` e preencha os segredos diretamente pelo painel. O bot não precisa de domínio/HTTP. Quando der deploy, observe `Bot logado` e `Comandos cadastrados` nos logs. A hospedagem contínua depende do plano e dos limites do Railway.

## Segurança e privacidade

- O histórico individual (até 12 mensagens por usuário, 14 dias) e preferências voluntárias explicitamente salvas ficam no Supabase. A memória coletiva recente de canais públicos fica apenas em RAM e não é gravada como transcrição permanente. O contexto do canal é buscado no Discord quando alguém menciona a bot e não é salvo em banco. As mensagens são excluídas por `/duckzinha apagar-me` e administradores podem resetar as memórias.
- Avise os membros do servidor de que, quando mencionada, a Duckzinha utiliza mensagens recentes do mesmo canal público para contextualizar respostas; o conteúdo é enviado ao provedor Cloudflare Workers AI. A bot não coleta mensagens privadas nem arquivos/anexos como contexto.
- O prompt de `/configurar` tem acesso restrito aos administradores, fica salvo em `duckzinha_config` e não deve conter tokens nem dados pessoais.
- O banco usa tabelas próprias com RLS; a chave `service_role` deve ficar apenas nas variáveis secretas da FadeHost.

- O arquivo `knowledge.json` contém **exemplos de conhecimento da comunidade informados pelo criador**, não fatos históricos verificados.
- A exclusão de mensagens só funciona quando o bot tem acesso ao canal e às próprias mensagens. Mensagens efêmeras do Discord seguem as regras do próprio Discord.
- APIs de IA possuem limites; Não há limite diário interno de mensagens de IA, mas há antispam e limites/cotas do provedor; acompanhe o consumo no painel Cloudflare.
- Configuração de contas externas deve respeitar a idade mínima e os termos de cada plataforma; peça ajuda a um responsável quando necessário. Não tente contornar restrições etárias.

## Testes

```bash
npm run check
npm test
```

## Arquivos

- `src/community-events.mjs`: identificação segura de tickets privados e textos de boas-vindas.

- `src/bot.mjs`: Discord, respostas por menção, limpeza, fila e inicialização.
- `src/brain.mjs`: personalidade, resposta básica e requisição opcional ao modelo.
- `src/community-social.mjs`: familiaridade, gatilhos de imagens e dicas de atendimento.
- `src/emoji-reactions.mjs`: nomes e variáveis dos emojis personalizados para reação direta.
- `src/reaction-intent.mjs`: classificação semântica opcional por Workers AI para saudações e outras reações em texto público, com limitação de frequência e proteção contra mensagens sensíveis.
- `assets/reactions/README.md`: imagens da Duckzinha para as boas-vindas e para usar como base na criação de emojis.
- `src/commands.mjs`: comandos e embeds.
- `src/store.mjs`: memória e aprendizagem no Supabase.
- `knowledge.json`: conhecimento inicial sobre BoxPvP e comunidade.
- `sql/schema.sql`: tabelas de memória, ensinamentos e exclusão agendada.
- `.env.example`: nomes de variáveis **sem valores secretos**.

> A Duckzinha está hospedada separadamente na FadeHost. Após alterar o GitHub, reinicie/reimplante o serviço para usar a nova versão. Em Environment Variables, mantenha os tokens e IDs secretos.

## Configurar a personalidade pelo Discord

Como administrador, envie `/configurar arquivo:` e anexe um `.txt` codificado em UTF-8. O conteúdo substitui a personalidade personalizada anterior (mantendo as regras fixas de segurança da bot). Não envie tokens ou senhas no arquivo. A tabela `duckzinha_config` é criada pelo `sql/schema.sql`.

## Pesquisa ampla na web e botão Ver fontes (Tavily + Serper)

Cadastre `TAVILY_API_KEY` e `SERPER_API_KEY` nas variáveis privadas da FadeHost. As chaves não devem aparecer no GitHub ou no chat. A Tavily oferece 1.000 créditos mensais gratuitos e o Serper 2.500 pesquisas gratuitas iniciais (não renovadas todo mês). A Duckzinha usa Tavily primeiro e Serper quando a Tavily não retornar resultados ou estiver sem cota/indisponível; qualquer um dos dois funciona sozinho. Sem ambas as chaves, informa que a busca ampla não está configurada. Ao ficar em dúvida numa pergunta factual, a Duckzinha pergunta se pode pesquisar; apenas depois de um `sim` do mesmo usuário ela consulta a web. Se não encontrar resultados, avisa sem inventar. O comando de pesquisa explícito não requer segunda confirmação. O botão **Ver fontes** só aparece quando a API devolve resultados, enquanto **Eu explico** e **Pesquisar** aparecem se a IA sinalizar dúvida. No primeiro caso, o membro deve mencionar a Duckzinha com sua explicação; ela utiliza esse conteúdo na conversa, sem considerá-lo conhecimento verificado.


## Duckzinha Studio (novo)
- Use `/avatar` para receber um link individual e temporário (5 minutos) para personalizar o patinho; as escolhas são gravadas no Supabase, sem senha do Discord. Não envie esse link para outras pessoas.
- Use `/ver pessoa usuario:@membro` para ver a arte PNG salva. `/perfil` exibe o avatar e os acertos de quiz da sessão atual. `/jogo quiz` permite brincar com botões interativos.
- `/painel` abre o editor administrativo via link temporário; o painel permite ajustar o humor, a voz expressiva e as reações especiais. `/falar` manda áudio sintetizado com limite de tamanho e intervalo entre pedidos. `/reacao` envia uma das artes disponíveis.
- `/novidade publicar` é exclusivo de quem pode gerenciar o servidor, e `/novidades` lista anúncios publicados. Não publica automaticamente mudanças sem confirmação da equipe.
- As reações visuais dependem dos arquivos presentes em `assets/reactions`; algumas variantes ainda precisam receber suas ilustrações finais.
- Para ativar o Studio na FadeHost, ative um endereço WEB/HTTPS para o serviço Node, roteando a porta do processo (`PORT` quando a hospedagem fornecer, senão 8080), e configure `APP_URL` com o endereço HTTPS **somente se a FadeHost não o definir automaticamente**. Sem um URL HTTPS público, o bot continuará rodando, mas `/avatar` e `/painel` não poderão fornecer o link.
- Aplique as instruções adicionadas em `sql/schema.sql` no Supabase: nova coluna `features` e tabelas `duckzinha_avatars` e `duckzinha_project_updates`. Nenhuma chave extra é necessária.
- `/duckzinha apagar-me` apaga também o avatar da pessoa. O site não coleta áudio. **Conversa por voz com reconhecimento de fala ainda NÃO está habilitada**: requer fluxo explícito de consentimento, limite de retenção e serviço de transcrição testado, sem iniciar escuta automática.
- A personalização do Google TTS altera somente tom e velocidade, e não oferece as vozes neurais do Edge.


## Outubro de 2026 • Anúncios, Studio e Quiz Streak
- `/novidade publicar texto:` agora recebe **um único campo** com o anúncio inteiro, incluindo título, Markdown do Discord (`#`, `**negrito**`, `>`) e quebras de linha. Publica como mensagem normal para preservar cabeçalhos e citações. Até 1.800 caracteres; requer Gerenciar Servidor. A tabela de novidades permite 1.800 caracteres, sem novas variáveis de ambiente.
- `/jogo quiz` começa uma sequência de acertos: cada resposta correta atualiza **a mesma mensagem privada** com a próxima pergunta; um erro encerra a rodada. O nível sobe a cada três acertos até chegar a Mestre (nível 5). A pessoa tem 90 segundos por pergunta, existem cinco bancos de dificuldade e perguntas não se repetem enquanto houver outras disponíveis naquele nível. `/perfil` mostra o recorde e a sequência atual. Os recordes são temporários e reiniciam quando o processo reinicia.
- O Studio agora renderiza avatares PNG de **384×384** com gradientes, luz e sombra, acessórios por camada e maior variedade de visuais. Categorias: cores do patinho, fundo, olhos, chapéus e coroas, óculos e máscaras, roupas, punhos/luvas, auras e pets. Há presets Fofo e PvP e sorteio. As personalizações anteriores (`acessorio`) são convertidas para a camada equivalente quando possível.
- Para atualizar o bot existente na FadeHost, use a branch `asasa`, rode `npm install` se necessário e reinicie. Os comandos slash são recadastrados na inicialização. Rode `npm run check` e `npm test` para conferir os módulos.
- O site de avatar ainda exige que o Studio esteja acessível por HTTPS público e que `APP_URL` seja reconhecida pelo processo, conforme a configuração já existente do serviço.


## Quiz público da galera + botões de pesquisa no chat da call
- `/jogo quiz` inicia **uma partida pública por canal**, com perguntas e botões que todas as pessoas no canal podem usar. As respostas são confirmadas por mensagem privada: clicar **não apaga a pergunta** nem impede as demais respostas.
- Cada rodada dura **35 segundos**; no fim a Duckzinha edita aquela mensagem para mostrar **quem acertou e passou**, sem expor quem errou. Se houver classificados, a próxima pergunta é publicada após **4 segundos**, só para quem passou, ficando mais difícil a cada 3 rodadas, até o nível Mestre. A partida acaba quando ninguém acerta ou após 30 rodadas.
- Quem tem a permissão `Gerenciar Mensagens` pode usar `/jogo parar` para encerrar a partida do canal. Há limite de uma partida simultânea por canal.
- No **chat da call**, o botão **Pesquisar** aparece sozinho **somente se a Duckzinha não souber responder ou estiver sem certeza** (por exemplo, “não sei o que é”). Não aparece em toda menção. O botão só executa a busca depois do clique da pessoa que perguntou, com as chaves de pesquisa já configuradas; depois aparecem as fontes e o resultado também pode ser falado pela bot conectada à call. Nenhuma ENV nova foi adicionada.

## Atualização: cosméticos, avatar do bot e voz nativa
- Removidas do editor as três máscaras: pato, corvo e japonesa. Avatares antigos com uma dessas máscaras agora exibem o rosto normal. Nenhum dado do restante do avatar é apagado.
- Os estilos de aura agora têm camadas de brilho, órbitas suaves e partículas específicas (fogo, gelo, raios, moedas, corações e estrelas); as roupas, chapéus, punhos e pets também ganharam detalhes de costura, luz e sombra.
- O painel de **Administração** inclui **Editar avatar da Duckzinha**. Ao clicar, abre o editor com a personalização oficial da bot, separada do avatar pessoal. Use **Salvar visual** para guardar no Supabase e **Aplicar como foto do bot no Discord** para trocar a imagem de perfil do próprio bot quando desejar. O servidor confere a permissão Administrator novamente a cada ação.
- O comando `/falar` agora converte o TTS para Ogg/Opus mono, calcula duração + forma de onda e envia uma **mensagem de voz nativa** com a flag `IS_VOICE_MESSAGE` pela API do Discord. A confirmação do slash command é privada e não inclui o áudio. O bot precisa das permissões Ver canal, Enviar mensagens, Anexar arquivos e Enviar mensagens de voz. A compatibilidade visual final depende do cliente Discord e das permissões do servidor.
- A versão discord.js 14.22.1 instalada não contém os métodos de duração/forma de onda de versões futuras de AttachmentBuilder, então a mensagem de voz é enviada via REST oficial do mesmo cliente, sem serviços externos nem ENVs novas.
- Para atualizar a FadeHost use a branch `asasa`, atualize os arquivos e reinicie. Execute `npm install` se necessário.


## Melhorias de aura e controle de /falar
- O editor não disponibiliza mais **Luvas de Boxe** nem **Luvas Brancas**. Quem havia selecionado alguma delas verá automaticamente `Nenhuma` nesse slot, sem apagar cores, roupas, auras e outros cosméticos. **Garras Spring** e **Punhos de Gelo, Fogo e Corrompidos** continuam.
- As sete auras (`brilho`, `estrelas`, `coracoes`, `fogo`, `gelo`, `eletrica`, `dinheiro`) ganharam novas camadas de iluminação, símbolos próprios, detalhes por categoria, partículas e brilhos nas laterais. Existe uma camada de efeitos atrás do pato e outra sutil perto das asas e dos pés, para não atrapalhar rosto/olhos.
- O comando `/falar` agora requer a permissão **Administrador**: os membros comuns não recebem a opção por padrão, e tentativas indevidas são bloqueadas pelo próprio bot antes de gerar qualquer áudio. A mensagem de bloqueio é privada. Não são necessárias ENVs adicionais.


## Mais vozes animadas — outubro de 2026
- `/duckzinha voice nome:` agora oferece **20 estilos**, incluindo 9 novos: Francisca Bem Animada, Super Animada e Fofinha Animada; Thalita Animada e Super Animada; Raquel Animada e Super Animada; Antônio Animado; Duarte Animado. O limite de 25 opções estáticas do Discord é respeitado.
- A voz escolhida continua sendo salva no Supabase e pode ser testada com `/duckzinha testevoz` (admin). Não é necessário criar ENV nova nem alterar tabelas.
- O ajuste `Voz expressiva` associa automaticamente o humor animado às variações de Francisca, Thalita, Raquel, Antônio e Duarte quando a base natural está selecionada. Uma variação explicitamente escolhida pelo admin não é substituída pelo humor.
- **Importante:** os novos itens são presets de pitch/ritmo sobre as cinco vozes-base já utilizadas, **não** vozes neurais inéditas. Quando o Edge TTS estiver indisponível, o Google TTS usa os ajustes locais com FFmpeg, sem criar novos timbres de locutor.


## 🦆 Duck RPG — batalhas por turnos, níveis e TMs
- **/pato perfil** mostra tipo, nível (1–30), XP para subir, moedas, golpes e inventário. Também aceita `usuario:` para consultar outro membro.
- **/pato tipo elemento:** escolhe entre Normal 🦆, Água 🌊, Fogo 🔥, Natureza 🌿, Elétrico ⚡ e Gelo ❄️. A primeira escolha é gratuita. Alterar depois exige uma Essência Elemental comprada na loja; os TMs conhecidos são preservados na mudança de tipo.
- **/pato loja** mostra preços fixos de ração (+50 XP), super ração (+140 XP), Essência Elemental e seis TMs.
- **/pato comprar item:** usa somente as **moedas de pato já ganhas no servidor**, sem dinheiro real e sem apostas. A transação é atômica no Supabase e rejeita saldo insuficiente e inventário cheio.
- **/pato usar item:** consome ração do inventário e dá XP, subindo automaticamente de nível ao atingir o limite.
- **/pato tm item: slot:** gasta uma TM e **substitui um dos 3 golpes equipados**, mantendo os outros. TMs ensinam Onda Gigante, Fúria Solar, Trovão Patônico, Abraço da Floresta, Nevasca de Penas ou Cometa de Borracha.
- **/batalha pessoa:** envia um desafio que o outro jogador deve aceitar em 60 s. A arena mostra barras de HP, tipo, nível e turno; há botões de **3 golpes**, **Defender** e **Desistir**. Apenas o jogador da vez pode atacar. As relações elementais oferecem vantagens e resistências, e a defesa reduz dano. Turno expira em 90 s. Partidas completas rendem XP (12 ao vencedor, 5 ao outro), limitados a 100 XP de batalha por dia. Confrontos curtíssimos e desistências não rendem XP.
- As batalhas nunca debitam moedas, não incluem apostas nem dinheiro real. Ao reiniciar o servidor, batalhas abertas são encerradas sem perda de recursos. O nível, os golpes, os itens e o tipo ficam no Supabase.
- A economia base continua sendo **/afk iniciar**, **/afk resgatar**, conversar com a Duckzinha e ensinar fatos da comunidade conforme permissões. Os limites diários evitam multiplicação de moedas por cliques.
- **Migrações reutilizáveis:** `sql/duck-economy.sql` (moedas e conjuntos visuais) seguida de `sql/duck-rpg.sql` (pato e transações). Já foram aplicadas no Supabase atual. Não há novas ENVs.
- Atualize a branch `asasa` na FadeHost e reinicie o bot para recadastrar os slash commands. Valide com `npm run check` e `npm test`. Não foi possível executar batalhas reais no Discord a partir do GitHub.
