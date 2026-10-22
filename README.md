# 🦆 Duckzinha — Assistente do DuckzinCommunity (versão 1)

Bot **separado** do Duckzin Bridge. Escrito em Node.js 22 + discord.js 14. Ele **apenas publica avisos em novos tickets** (quando configurado) e não altera tickets, não consulta canais privados de suporte para gerar respostas de IA, não se passa por humano e não exige chave de IA para iniciar.

## O que já faz

- Responde normalmente quando **mencionada diretamente** `@Duckzinha` no servidor. Exceção: confirma pedidos explícitos de memória feitos em canais públicos; não responde a DMs.
- Personalidade simpática, educada, simples, com emojis, GG/W/KKKK quando combinar.
- `/ajuda`, `/website`, `/ticket`, `/projetos`, `/boxpvp`, `/faq`, `/sobre`, `/ping`.
- **Conversa coletiva em canais públicos:** lê mensagens normais de canais públicos para manter em RAM até 100 mensagens recentes (máximo de 48 horas), inclusive entre canais públicos, sem persistir esse chat completo. Ao ser mencionada, também consulta mensagens recentes do canal. Nunca inclui tickets, DMs, canais privados ou canais da equipe nessa memória coletiva. A RAM é apagada ao reiniciar.
- **Boas-vindas automáticas:** com `WELCOME_CHANNEL_ID` definido na FadeHost e **Server Members Intent** ativado no Discord Developer Portal, a Duckzinha cumprimenta os novos membros no canal de entrada. Ela não faz menção a cargos nem envia DMs.
- **Aviso em tickets recém-criados:** quando um bot de tickets cria um **canal de texto privado** em `TICKET_CATEGORY_ID`, a Duckzinha avisa para aguardar a staff. Sem essa variável, ela só reconhece canais privados com prefixos `ticket-`, `tickets-` ou `atendimento-` (ou usando `_`). A bot precisa ter acesso e permissão de enviar mensagens nesse canal. Não interfere na criação ou fechamento de tickets, nem lê o conteúdo para esse aviso. A mensagem de espera não é apagada automaticamente.
- **Continuidade de conversa:** até 12 mensagens por usuário, armazenadas no Supabase por até 14 dias. Agora o histórico pessoal é enviado **junto** com as mensagens recentes do canal, em vez de ser descartado. Perguntas curtas como `e o jogo?`, `e o filme?` ou `e a história?` retomam explicitamente o último assunto da mesma pessoa, quando houver histórico.
- **Memória permanente com consentimento:** em canal público, cada membro pode dizer `lembra que meu jogo favorito é Minecraft`, `lembra que minha cor favorita é amarelo`, `lembra que eu gosto de jogar Minecraft` etc. A preferência fica na tabela `duckzinha_profile_facts`, sem prazo de expiração, até o membro apagá-la. O bot só mostra **🧠 Memória atualizada!** se a gravação for confirmada no banco. Afirmações comuns e sobre terceiros não viram fatos pessoais permanentes.
- **Memória oficial do servidor:** membros com permissão **Gerenciar servidor** podem dizer em canal público `lembra que o servidor tem modo survival` para guardar um fato no conhecimento coletivo. Não é necessário mencionar a Duckzinha quando se pede para lembrar.
- **Controle da memória:** `/duckzinha minhas-memorias` mostra ao próprio membro suas preferências, de modo privado; `/duckzinha apagar-me` remove histórico curto, nome e preferências pessoais; `/duckzinha reset` faz a limpeza da memória pessoal de todos os membros (administradores). Informações oficiais da comunidade são gerenciadas em `/ensinamentos`.
- **Continuidade depois de pesquisar:** sempre que Tavily ou Serper devolvem resultados e a Duckzinha responde, o bot registra no histórico pessoal a pergunta, a resposta e um resumo curto das páginas consultadas — inclusive quando a busca partiu do botão **Pesquisar** ou a IA precisou de resposta básica. As próximas perguntas recebem esse resumo para não sugerir uma nova pesquisa sobre o que já foi explicado. Essa memória de pesquisa é **histórico temporário de conversa** (até 12 mensagens, 14 dias), não um ensinamento permanente do servidor. Se a nova pergunta exigir detalhes ausentes nas fontes anteriores, ela poderá oferecer outra pesquisa.
- **Brincadeiras compartilhadas:** mensagens engraçadas recentes podem ser retomadas pelo histórico habitual; cada membro também pode pedir explicitamente `lembra que meu bordão é pato rei` ou `lembra que minha piada favorita é pato ninja`, guardando só sua própria preferência.
- **Familiaridade sem ranking público:** a Duckzinha reconhece se um membro já conversou algumas vezes com ela. O indicador é uma contagem simples de respostas ao mencionar a bot em canal público, guardada na tabela protegida `duckzinha_familiarity`; não cria relações exclusivas nem mede quem é melhor. `/amizade` mostra a informação privadamente. `/duckzinha apagar-me` também exclui essa contagem.
- **Emojis personalizados como reações:** a Duckzinha reage **na mensagem original** em canais públicos, sem mandar outra mensagem ou figurinha. Procura emojis criados no servidor chamados `duckzinha_ola`, `duckzinha_riso`, `duckzinha_fofo`, `duckzinha_gg` e `duckzinha_surpresa`. Também aceita os IDs opcionais `DUCK_EMOJI_OLA`, `DUCK_EMOJI_RISO`, `DUCK_EMOJI_FOFO`, `DUCK_EMOJI_GG` e `DUCK_EMOJI_SURPRESA` na FadeHost. Sem emoji correspondente, não reage. Saudações têm prioridade quando o intervalo permite; os outros gatilhos têm chance de 12%. Limites: no mínimo 5 minutos entre reações do bot no servidor e 20 minutos por canal. **Permissões:** Adicionar reações e Ler histórico de mensagens. Não reage em tickets, canais privados ou DMs. **Nas boas-vindas**, o bot continua enviando a imagem `assets/reactions/ola.webp` como anexo, sem depender de emojis personalizados.
- **Orientação adicional em tickets:** ao criar um canal de ticket privado, a Duckzinha mostra o botão **Como explicar meu problema**. Ao clicar, só o membro vê orientações para contar o erro, versão e o que já tentou, sem divulgar senhas nem dados pessoais.
- **Pesquisa na web com botões:** quando não tem certeza sobre uma pergunta factual (ex.: "o que é MushMC?"), a Duckzinha oferece os botões **Eu explico** e **Pesquisar**. O primeiro deixa o autor explicar no chat, sem gravar aquilo automaticamente como conhecimento oficial do servidor. O segundo consulta Tavily e, se necessário, Serper. Depois de pesquisar, mostra **Ver fontes**; cada pessoa pode clicar para visualizar os links em uma resposta privada do Discord. Os botões são temporários e não sobrevivem totalmente a reinicializações da hospedagem. A busca direta por mensagem continua disponível. Apenas fontes que o buscador efetivamente retornou são exibidas.
- `/duckzinha apagar-me`: cada membro pode excluir histórico e nome. `/duckzinha reset`: exclusivo para administradores, apaga a memória dos membros.
- `/configurar arquivo:<arquivo.txt>`: administradores podem enviar um TXT UTF-8 com a personalidade e o comportamento desejado (até 8.000 caracteres). O texto fica salvo no Supabase e é aplicado às próximas respostas.

- `/ensinar` e `/ensinamentos`: administradores configuram assuntos sem editar o código (com Supabase ativo).
- Respostas públicas enviadas pela Duckzinha são apagadas em **20 minutos** (apenas as respostas **dela**, nunca as dos usuários). Agendamento persiste após reinício se o Supabase estiver configurado.
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
