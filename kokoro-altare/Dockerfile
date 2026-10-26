# Imagem CPU oficial do Kokoro com a porta da Altare já configurada.
FROM ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0

# A Altare publica externamente a porta 25715.
# Modelos já vêm incluídos na imagem CPU oficial.
ENV HOST=0.0.0.0 \
    PORT=25715 \
    DOWNLOAD_MODEL=false \
    TEMP_FILE_DIR=/tmp/kokoro-audio

EXPOSE 25715

# Mantemos CMD/entrypoint oficiais, que respeitam HOST e PORT.
