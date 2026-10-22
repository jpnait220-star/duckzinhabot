# 🦆 Duckzinha — Assistente do DuckzinCommunity (versão 1)

Bot **separado** do Duckzin Bridge. Escrito em Node.js 22 + discord.js 14. Ele **não altera tickets**, não lê outros canais por conta própria, não se passa por humano e não exige chave de IA para iniciar.

## O que já faz

- Responde quando **mencionada diretamente** `@Duckzinha` no servidor (não reage a mensagens normais nem a DMs).
- Personalidade simpática, educada, simples, com emojis, GG/W/KKKK quando combinar.
- `/ajuda`, `/website`, `/ticket`, `/projetos`, `/boxpvp`, `/faq`, `/sobre`, `/ping`.
- **Conversa coletiva por canal:** quando mencionada, a Duckzinha consulta até 25 mensagens anteriores do canal público, considera no máximo 16 mensagens dos últimos 30 minutos e distingue os autores. Ela continua respondendo **somente quando mencionada**, não vigia outros canais e não salva esse histórico coletivo no Supabase. Como lê o Discord ao ser chamada, o contexto recente continua disponível após reinícios enquanto as mensagens estiverem no canal.
- **Histórico pessoal:** até 12 mensagens por usuário, armazenadas no Supabase por até 14 dias, usado como alternativa quando não há contexto de canal.
- **Pesquisa web com autorização:** quando a IA não souber um fato, pergunta se o membro quer pesquisar mais a fundo; respostas `sim` e `não` são aceitas na conversa. Se alguém pedir diretamente `pesquise sobre ...`, a busca começa sem a pergunta adicional. A busca tenta Tavily primeiro (`TAVILY_API_KEY`) e troca automaticamente para Serper (`SERPER_API_KEY`) se a Tavily acabar, falhar ou não encontrar resultados. Com apenas uma das chaves também funciona.
- `/duckzinha apagar-me`: cada membro pode excluir histórico e nome. `/duckzinha reset`: exclusivo para administradores, apaga a memória dos membros.
- `/configurar arquivo:<arquivo.txt>`: administradores podem enviar um TXT UTF-8 com a personalidade e o comportamento desejado (até 8.000 caracteres). O texto fica salvo no Supabase e é aplicado às próximas respostas.

- `/ensinar` e `/ensinamentos`: administradores configuram assuntos sem editar o código (com Supabase ativo).
- Respostas públicas enviadas pela Duckzinha são apagadas em **20 minutos** (apenas as respostas **dela**, nunca as dos usuários). Agendamento persiste após reinício se o Supabase estiver configurado.
- IA opcional **Cloudflare Workers AI: `@cf/google/gemma-4-26b-a4b-it`**; fallback para respostas básicas quando não houver configuração, o serviço falhar ou atingir a cota. As mensagens enviadas à IA podem incluir falas recentes de outros membros do mesmo canal público quando a bot é mencionada, para que participe do contexto coletivo.

## Antes de executar

1. Crie um **novo aplicativo/bot** no Discord Developer Portal: não use o token do Duckzin Bridge. Ative **Message Content Intent** nas configurações de Bot (caso permitido/necessário). Nas permissões, conceda somente **View Channels, Send Messages, Embed Links, Read Message History** e o escopo `applications.commands` ao instalar.
2. Faça uma cópia de `.env.example` para `.env`, preencha os IDs do **novo bot** e o ID do servidor. **Não publique `.env`, chaves ou tokens**, nem mesmo no GitHub privado.
3. Instale Node.js 22. Rode `npm install` e `npm start`. Com apenas as variáveis Discord, já funcionam os comandos e as respostas básicas.
4. Para **memória persistente e aprendizado**, abra `sql/schema.sql`, execute no Supabase sob responsabilidade do administrador, e configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **somente na hospedagem**, nunca no site.
5. Para IA, quem atende aos requisitos do provedor pode configurar a conta/serviço e definir `CF_ACCOUNT_ID` e `CF_API_TOKEN` diretamente no Railway. Não é preciso compartilhar a chave no chat. O modelo e o endpoint podem ser alterados no `.env`.

## Railway (24/7)

Crie um **novo repositório privado** só para a Duckzinha. Publique os arquivos deste ZIP (exceto `.env` e `node_modules`). No Railway, crie um serviço separado pelo GitHub, Node 22, comando de inicialização `npm start`, **uma única réplica**. Em **Variables**, copie os nomes de `.env.example` e preencha os segredos diretamente pelo painel. O bot não precisa de domínio/HTTP. Quando der deploy, observe `Bot logado` e `Comandos cadastrados` nos logs. A hospedagem contínua depende do plano e dos limites do Railway.

## Segurança e privacidade

- Apenas o histórico individual (até 12 mensagens por usuário, 14 dias) é guardado no Supabase. O contexto do canal é buscado no Discord quando alguém menciona a bot e não é salvo em banco. As mensagens são excluídas por `/duckzinha apagar-me` e administradores podem resetar as memórias.
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

- `src/bot.mjs`: Discord, respostas por menção, limpeza, fila e inicialização.
- `src/brain.mjs`: personalidade, resposta básica e requisição opcional ao modelo.
- `src/commands.mjs`: comandos e embeds.
- `src/store.mjs`: memória e aprendizagem no Supabase.
- `knowledge.json`: conhecimento inicial sobre BoxPvP e comunidade.
- `sql/schema.sql`: tabelas de memória, ensinamentos e exclusão agendada.
- `.env.example`: nomes de variáveis **sem valores secretos**.

> A Duckzinha está hospedada separadamente na FadeHost. Após alterar o GitHub, reinicie/reimplante o serviço para usar a nova versão. Em Environment Variables, mantenha os tokens e IDs secretos.

## Configurar a personalidade pelo Discord

Como administrador, envie `/configurar arquivo:` e anexe um `.txt` codificado em UTF-8. O conteúdo substitui a personalidade personalizada anterior (mantendo as regras fixas de segurança da bot). Não envie tokens ou senhas no arquivo. A tabela `duckzinha_config` é criada pelo `sql/schema.sql`.

## Pesquisa ampla na web (Tavily + Serper)

Cadastre `TAVILY_API_KEY` e `SERPER_API_KEY` nas variáveis privadas da FadeHost. As chaves não devem aparecer no GitHub ou no chat. A Tavily oferece 1.000 créditos mensais gratuitos e o Serper 2.500 pesquisas gratuitas iniciais (não renovadas todo mês). A Duckzinha usa Tavily primeiro e Serper quando a Tavily não retornar resultados ou estiver sem cota/indisponível; qualquer um dos dois funciona sozinho. Sem ambas as chaves, informa que a busca ampla não está configurada. Ao ficar em dúvida numa pergunta factual, a Duckzinha pergunta se pode pesquisar; apenas depois de um `sim` do mesmo usuário ela consulta a web. Se não encontrar resultados, avisa sem inventar. O comando de pesquisa explícito não requer segunda confirmação.
