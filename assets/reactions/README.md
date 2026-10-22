# Emojis e imagens da Duckzinha

## Reações no chat — emojis personalizados do servidor

Crie seus emojis em **Configurações do Servidor → Emojis** no Discord, usando estes nomes:

- `duckzinha_ola` — imagem acenando; mensagens “oi”, “olá”, “bom dia”
- `duckzinha_riso` — imagem rindo; mensagens engraçadas
- `duckzinha_fofo` — imagem piscando; mensagens fofas
- `duckzinha_gg` — opcional, conquistas e vitórias
- `duckzinha_surpresa` — opcional, mensagens de surpresa

O bot os reconhece pelo nome, sem precisar configurar variáveis de ambiente. Se preferir informar um emoji pelo ID, use na FadeHost as variáveis `DUCK_EMOJI_OLA`, `DUCK_EMOJI_RISO`, `DUCK_EMOJI_FOFO`, `DUCK_EMOJI_GG` e `DUCK_EMOJI_SURPRESA`.

O bot **adiciona o emoji como reação na mensagem da pessoa**, não envia figurinha nem cria outra mensagem. Reações respeitam limites antispam e só são usadas em canais públicos. É necessária a permissão **Adicionar reações**.

## Boas-vindas — imagem anexada

A imagem `ola.webp` deste repositório **continua sendo enviada como anexo junto da mensagem de boas-vindas**. Isso acontece mesmo sem emoji personalizado criado no servidor, desde que a Duckzinha tenha a permissão **Anexar arquivos** no canal de entrada.

Arquivos nesta pasta: `ola.webp`, `riso.webp`, `fofo.webp`. As imagens da pasta podem servir como base para criar os emojis do Discord. 
