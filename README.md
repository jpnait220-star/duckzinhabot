# 🦆 Duckzinha — Assistente do DuckzinCommunity (versão 1)

Bot **separado** do Duckzin Bridge. Escrito em Node.js 22 + discord.js 14. Ele **não altera tickets**, não lê outros canais por conta própria, não se passa por humano e não exige chave de IA para iniciar.

## O que já faz

- Responde quando **mencionada diretamente** `@Duckzinha` no servidor (não reage a mensagens normais nem a DMs).
- Personalidade simpática, educada, simples, com emojis, GG/W/KKKK quando combinar.
- `/ajuda`, `/website`, `/ticket`, `/projetos`, `/boxpvp`, `/faq`, `/sobre`, `/ping`.
- Memória automática: até 12 mensagens recentes por usuário, armazenadas no Supabase por até 14 dias, para continuar conversas após reinícios.
- `/duckzinha apagar-me`: cada membro pode excluir histórico e nome. `/duckzinha reset`: exclusivo para administradores, apaga a memória dos membros.
- `/configurar arquivo:<arquivo.txt>`: administradores podem enviar um TXT UTF-8 com a personalidade e o comportamento desejado (até 8.000 caracteres). O texto fica salvo no Supabase e é aplicado às próximas respostas.

- `/ensinar` e `/ensinamentos`: administradores configuram assuntos sem editar o código (com Supabase ativo).
- Respostas públicas enviadas pela Duckzinha são apagadas em **20 minutos** (apenas as respostas **dela**, nunca as dos usuários). Agendamento persiste após reinício se o Supabase estiver configurado.
- IA opcional **Cloudflare Workers AI: `@cf/google/gemma-4-26b-a4b-it`**; fallback para respostas básicas quando não houver configuração, o serviço falhar ou atingir a cota. As mensagens enviadas à IA incluem apenas a pergunta recente e até doze mensagens recentes daquela conversa. Não usa respostas de outros membros.

## Antes de executar

1. Crie um **novo aplicativo/bot** no Discord Developer Portal: não use o token do Duckzin Bridge. Ative **Message Content Intent** nas configurações de Bot (caso permitido/necessário). Nas permissões, conceda somente **View Channels, Send Messages, Embed Links, Read Message History** e o escopo `applications.commands` ao instalar.
2. Faça uma cópia de `.env.example` para `.env`, preencha os IDs do **novo bot** e o ID do servidor. **Não publique `.env`, chaves ou tokens**, nem mesmo no GitHub privado.
3. Instale Node.js 22. Rode `npm install` e `npm start`. Com apenas as variáveis Discord, já funcionam os comandos e as respostas básicas.
4. Para **memória persistente e aprendizado**, abra `sql/schema.sql`, execute no Supabase sob responsabilidade do administrador, e configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **somente na hospedagem**, nunca no site.
5. Para IA, quem atende aos requisitos do provedor pode configurar a conta/serviço e definir `CF_ACCOUNT_ID` e `CF_API_TOKEN` diretamente no Railway. Não é preciso compartilhar a chave no chat. O modelo e o endpoint podem ser alterados no `.env`.

## Railway (24/7)

Crie um **novo repositório privado** só para a Duckzinha. Publique os arquivos deste ZIP (exceto `.env` e `node_modules`). No Railway, crie um serviço separado pelo GitHub, Node 22, comando de inicialização `npm start`, **uma única réplica**. Em **Variables**, copie os nomes de `.env.example` e preencha os segredos diretamente pelo painel. O bot não precisa de domínio/HTTP. Quando der deploy, observe `Bot logado` e `Comandos cadastrados` nos logs. A hospedagem contínua depende do plano e dos limites do Railway.

## Segurança e privacidade

- Até 12 mensagens por usuário ficam guardadas no Supabase para retomar a conversa após reiniciar, com expiração de 14 dias. As mensagens são excluídas por `/duckzinha apagar-me` e administradores podem resetar as memórias.
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
