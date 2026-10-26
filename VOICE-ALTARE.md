# Voz da Duckzinha na Altare (sem Kyoko)

A Duckzinha usa agora **Edge TTS** diretamente para falar na call. O Edge já está integrado ao servidor Node.js da bot, portanto **não precisa do servidor Kyoko, Piper, API key ou ENV nova**. Se o Edge falhar, a bot tenta Google TTS por HTTPS (com filtro local quando possível).

## Escolher a voz

O padrão para instalações novas/sem voz salva é **Thalita • Natural**, voz feminina em português brasileiro.

Se a escolha antiga ficou salva no Supabase, o comando abaixo é necessário para trocar a voz efetiva:

1. No Discord, execute `/duckzinha voice` e selecione **Thalita • Natural** (somente administrador).
2. Entre na call e execute `/duckzinha entrar`.
3. Execute `/duckzinha testevoz` para ouvir uma amostra.
4. Marque @Duckzinha no chat da call para ouvir as respostas normais.

O teste informa o motor de áudio (`edge`, `google` ou `google-styled`) e duração processada. Processamento não garante que o som foi transmitido pelo Discord: se não ouvir, verifique permissões **Ver canal / Conectar / Falar**, volume, silenciamento e logs de voz.

## Na hospedagem

- Não precisa iniciar o Kyoko.
- Não precisa adicionar ou mudar `KOKORO_TTS_URL`, `PIPER_TTS_URL` ou qualquer outra ENV para a voz.
- As configurações antigas do Kokoro podem continuar no `.env`; o código principal da bot não as usa para a call.
- Atualize os arquivos da pasta `duckzinhabot-asasa` com a versão nova do GitHub, preserve seu `.env` e reinicie o servidor da Duckzinha, não o Kyoko.
- Se aparecer `[Duckzinha] Falha de voz`, consulte o erro completo do Edge/Google e o estado do player no console.

As opções de voz continuam disponíveis no comando `/duckzinha voice`. As variações Fofinha, Animada e Suave ajustam tom/ritmo; não são modelos adicionais de IA.
