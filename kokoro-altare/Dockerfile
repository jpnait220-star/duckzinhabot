# Kokoro CPU adapted to Pterodactyl/Altare.
# Wings requires an actual OS user called 'container' inside custom images.
FROM ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0

ENV HOST=0.0.0.0 \
    PORT=25715 \
    DOWNLOAD_MODEL=false \
    TEMP_FILE_DIR=/tmp/duckzinha-kokoro \
    PYTHONPATH=/app:/app/api \
    HOME=/home/container \
    USER=container

USER root
RUN useradd -m -d /home/container -s /bin/bash container \
    && chmod 755 /home/container
COPY --chmod=755 start-kokoro-altare.sh /entrypoint.sh

USER container
WORKDIR /home/container
EXPOSE 25715

# The panel may override CMD with STARTUP; /entrypoint.sh also works
# when called explicitly from Altare's Startup Command field.
CMD ["/bin/bash", "/entrypoint.sh"]
