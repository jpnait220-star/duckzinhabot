# Duckzinha — conversa pública sem precisar de menção

## Comportamento

A Duckzinha acompanha mensagens normais dos canais públicos autorizados e pode participar sem @Duckzinha. Não é necessário já ter uma conversa com a bot para ela entrar no assunto. Mensagens recentes de outros membros entram no contexto com os autores identificados, incluindo o nome de usuário quando o apelido for diferente.

A participação espontânea está **ligada por padrão**, mesmo que você mantenha seu .env atual. Por padrão, há pelo menos 20 segundos entre tentativas espontâneas no mesmo canal e 5 segundos entre canais, além de uma reserva para evitar respostas simultâneas. A IA pode optar por não falar quando não tiver contribuição útil. Comandos, outros bots, mensagens vazias e risadas isoladas não iniciam uma conversa automática. Menções e comandos da Duckzinha continuam funcionando normalmente.

O bot usa a conversa **recente**, não uma memória ilimitada de todo o Discord. Consulta até 50 mensagens anteriores do canal público atual e mantém as mensagens públicas recentes recebidas em RAM como reserva se a consulta falhar. Não exige menção para essas mensagens entrarem no contexto. A retenção de conversa e preferências no Supabase continua com os limites anteriores; não foi criada uma gravação permanente de todo o chat.

Canais privados, tickets, DMs e canais excluídos pelas regras anteriores não entram na participação espontânea. Não são acionadas automaticamente moderação, música, entrada em call, mensagens para terceiros ou buscas externas. Falhas de IA durante participação espontânea ficam no console, sem publicar a mensagem genérica de erro no chat. A participação espontânea não concede recompensas de conversa nem aumenta familiaridade automaticamente.

## Histórico e falhas de IA

- A tentativa reduzida do Workers AI mantém o contexto do canal, autor, histórico pessoal e trechos das pesquisas. Antes, o retry perdia a conversa coletiva.
- Uma falha temporária de rede ou de servidor pode receber uma nova tentativa, no máximo uma. Chaves inválidas e cota esgotada não entram em repetição. Falhas/cotas reais do provedor ainda podem impedir respostas.
- Perguntas diretas como “oq prime_mat falou” podem repetir a última fala disponível dessa pessoa sem depender da IA. Isso complementa a conversa automática; não é a única forma de ler o chat.
- Leituras bem-sucedidas da API são prioritárias para não reintroduzir mensagens apagadas a partir do cache. Se a consulta falhar, o cache usado é apenas do canal público atual.

## Aplicar na Altare

1. Pare a Duckzinha e faça uma cópia dos arquivos atuais.
2. Extraia o ZIP na pasta que contém package.json, substituindo o código e incluindo os novos src/duck-auto-chat.mjs e src/duck-chat-context.mjs. **Preserve o .env e as variáveis da host.**
3. Use Node.js 22.12 ou superior e inicialização npm start. Não há dependências novas nesta alteração.
4. No Discord Developer Portal → aplicativo da Duckzinha → Bot, deixe **Message Content Intent** ativado. No Discord, permita **Ver canal, Ler histórico de mensagens e Enviar mensagens** nos canais em que ela deve conversar.
5. Reinicie uma única instância. Escreva uma pergunta ou uma fala normal em um canal público, sem menção, e observe a participação respeitando os intervalos. Para atendimento direto, mencionar continua disponível.

Opcionais no .env:

```env
AUTO_CHAT_ENABLED=true
AUTO_CHAT_CHANNEL_IDS=
AUTO_CHAT_INTERVAL_SECONDS=20
```

AUTO_CHAT_CHANNEL_IDS vazio permite os canais públicos aceitos pelas regras anteriores; para limitar, informe IDs separados por vírgula. AUTO_CHAT_ENABLED=false desativa a participação espontânea e mantém menções/comandos. O intervalo mínimo de configuração é 5 segundos por canal.

O domínio da Community continua https://duckcommunity.go.altare.global e a configuração de domínio antigo continua sendo migrada como no pacote anterior.

## Validação

45 testes dos fluxos de contexto, conversa sem menção, silêncio, limites, histórico e recuperação do Workers AI passaram. A suíte completa passou em 261 de 265 testes; as quatro falhas de catálogo /ajuda e /profile foram reproduzidas também no commit anterior, sem estas mudanças, e não foram alteradas nesta atualização. Os testes de áudio/vídeo usaram o FFmpeg instalado no ambiente, sem incluir binários/node_modules no ZIP.

Foi corrigida uma expectativa antiga de um teste de histórico: o esquema existente aceita 12 mensagens (seis trocas), portanto o teste de reinicialização deve respeitar esse limite, não presumir 20. O limite e o esquema do banco não mudaram.

Não foi conectado um bot real ao Discord nem enviada mensagem, criado ticket ou alterado registro no banco durante os testes. É preciso instalar este código na sua host para mudar o comportamento em execução.
