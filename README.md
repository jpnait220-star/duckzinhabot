# 🦆 Duckzinha — Assistente do DuckzinCommunity (versão 1)

Bot **separado** do Duckzin Bridge. Escrito em Node.js 22 + discord.js 14. Ele **não altera tickets**, não lê outros canais por conta própria, não se passa por humano e não exige chave de IA para iniciar.

## O que já faz

- Responde quando **mencionada diretamente** `@Duckzinha` no servidor (não reage a mensagens normais nem a DMs).
- Personalidade simpática, educada, simples, com emojis, GG/W/KKKK quando combinar.
- `/ajuda`, `/website`, `/ticket`, `/projetos`, `/boxpvp`, `/faq`, `/sobre`, `/ping`.
- `/memoria ativar`, `/memoria ver`, `/memoria apagar`: nome opcional por usuário; apagar remove o nome e o consentimento. **Sem salvar conversas inteiras no banco.**
- `/ensinar` e `/ensinamentos`: administradores configuram assuntos sem editar o código (com Supabase ativo).
- Respostas públicas enviadas pela Duckzinha são apagadas em **20 minutos** (apenas as respostas **dela**, nunca as dos usuários). Agendamento persiste após reinício se o Supabase estiver configurado.
- IA opcional **Cloudflare Workers AI: `@cf/qwen/qwen3-30b-a3b-fp8`**; fallback para respostas básicas quando não houver configuração, o serviço falhar ou atingir a cota. As mensagens enviadas à IA incluem apenas a pergunta recente e até oito mensagens recentes daquela conversa. Não usa respostas de outros membros.

## Antes de executar

1. Crie um **novo aplicativo/bot** no Discord Developer Portal: não use o token do Duckzin Bridge. Ative **Message Content Intent** nas configurações de Bot (caso permitido/necessário). Nas permissões, conceda somente **View Channels, Send Messages, Embed Links, Read Message History** e o escopo `applications.commands` ao instalar.
2. Faça uma cópia de `.env.example` para `.env`, preencha os IDs do **novo bot** e o ID do servidor. **Não publique `.env`, chaves ou tokens**, nem mesmo no GitHub privado.
3. Instale Node.js 22. Rode `npm install` e `npm start`. Com apenas as variáveis Discord, já funcionam os comandos e as respostas básicas.
4. Para **memória persistente e aprendizado**, abra `sql/schema.sql`, execute no Supabase sob responsabilidade do administrador, e configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **somente na hospedagem**, nunca no site.
5. Para IA, quem atende aos requisitos do provedor pode configurar a conta/serviço e definir `CF_ACCOUNT_ID` e `CF_API_TOKEN` diretamente no Railway. Não é preciso compartilhar a chave no chat. O modelo e o endpoint podem ser alterados no `.env`.

## Railway (24/7)

Crie um **novo repositório privado** só para a Duckzinha. Publique os arquivos deste ZIP (exceto `.env` e `node_modules`). No Railway, crie um serviço separado pelo GitHub, Node 22, comando de inicialização `npm start`, **uma única réplica**. Em **Variables**, copie os nomes de `.env.example` e preencha os segredos diretamente pelo painel. O bot não precisa de domínio/HTTP. Quando der deploy, observe `Bot logado` e `Comandos cadastrados` nos logs. A hospedagem contínua depende do plano e dos limites do Railway.

## Segurança e privacidade

- A conversa temporária fica **apenas em RAM** por até 45 minutos para manter contexto. O bot **não salva o conteúdo das conversas** no Supabase.
- A única memória pessoal persistente é o **nome**, com `/memoria ativar` prévio; `/memoria apagar` remove tudo salvo sobre o membro. Não ensine nomes reais, endereços, telefones, senhas ou dados de outras pessoas.
- O Supabase cria três tabelas exclusivas `duckzinha_*`, com RLS e sem acesso ao público; a chave `service_role` só fica no processo do bot.
- O arquivo `knowledge.json` contém **exemplos de conhecimento da comunidade informados pelo criador**, não fatos históricos verificados.
- A exclusão de mensagens só funciona quando o bot tem acesso ao canal e às próprias mensagens. Mensagens efêmeras do Discord seguem as regras do próprio Discord.
- APIs de IA possuem limites; `DAILY_AI_LIMIT` é um limite adicional de segurança por instância. Não garante limite exato de cobrança, por isso confira o painel do provedor.
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

> Etapa atual: código criado e testado localmente. **Ainda não está hospedado nem conectado ao Discord**, porque a nova aplicação/token e as contas do provedor precisam ser configuradas pelo usuário/responsável.
