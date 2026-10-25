# Voz aberta da Duckzinha (Altare)

A Duckzinha agora tenta três motores, automaticamente:

1. Kokoro TTS (se `KOKORO_TTS_URL` estiver configurada);
2. Piper TTS (se `PIPER_TTS_URL` estiver configurada);
3. Edge TTS, o motor já existente. O fallback antigo do Google TTS continua sob a responsabilidade do código Edge.

**Nenhum token é necessário para ativar o fallback Edge.**
Kokoro e Piper são softwares que precisam rodar num serviço separado e acessível ao processo da Duckzinha. Não basta escrever o nome da voz no .env: sem URL de um serviço funcionando, a Duckzinha usa Edge. A Altare de 1 GB pode não ter recursos para rodar Kokoro no mesmo contêiner. Os provedores não foram implantados automaticamente.

## Ambiente (arquivo .env dentro de duckzinhabot-asasa)

```env
# URL HTTPS COMPLETA do endpoint OpenAI-compatible /v1/audio/speech do Kokoro
KOKORO_TTS_URL=
KOKORO_TTS_VOICE=pf_dora
# Opcional: somente se seu servidor TTS exigir um Bearer Token
KOKORO_TTS_TOKEN=

# URL HTTPS COMPLETA de um servidor Piper com adaptador OpenAI-compatible.
# A API padrão de muitos servidores Piper NÃO é /v1/audio/speech;
# nesses casos é necessário usar um adaptador compatível.
PIPER_TTS_URL=
PIPER_TTS_VOICE=
PIPER_TTS_TOKEN=
```

Exemplo do formato da URL: `https://SEU-HOST-QUE-HOSPEDA-TTS/v1/audio/speech` (exemplo, não é um servidor real).

Servidor Kokoro compatível: https://github.com/remsky/Kokoro-FastAPI
O servidor precisa aceitar JSON com `model`, `input`, `voice`, `response_format`; Kokoro deve retornar áudio Ogg/Opus ou WebM/Opus.

Servidor Piper: escolha um adaptador HTTP que aceite esse mesmo JSON em `/v1/audio/speech` e devolva WAV PCM16 mono (8–48kHz). O código converte WAV para PCM estéreo de 48kHz diretamente, sem depender de FFmpeg.

As URLs HTTPS públicas devem estar protegidas com autenticação quando expostas à internet, e as chaves ficam SOMENTE no .env ou no painel de variáveis da hospedagem. Não exponha endpoints sem controle de acesso.

## Teste

- Reinicie a Duckzinha na Altare depois de alterar o .env.
- Entre em uma call, execute `/duckzinha testevoz`.
- Procure no console `[Duckzinha] Voz aberta: kokoro` ou `piper`.
- Se houver erros, o motor com falha descansa 60 segundos e a Duckzinha usa o próximo.
- Com ambas URLs vazias, deve continuar usando Edge TTS normalmente.

Não é preciso criar conta paga ou obter token em provedor terceiro: apenas se um serviço auto-hospedado exigir autenticação você mesmo configura uma chave nele.

A implementação está preparada no bot, mas ainda depende da hospedagem/endpoint dos motores Kokoro/Piper para funcionar; não representa que esses servidores já estão online.
