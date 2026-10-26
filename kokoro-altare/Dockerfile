# Kokoro CPU for Altare/Pterodactyl.
# The stock image CMD is relative to /app and can fail when Wings
# launches it from /home/container. Use an absolute entrypoint.
FROM ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0

ENV HOST=0.0.0.0 \
    PORT=25715 \
    DOWNLOAD_MODEL=false \
    TEMP_FILE_DIR=/tmp/duckzinha-kokoro \
    PYTHONPATH=/app:/app/api \
    HOME=/home/container \
    USER=container

USER root
RUN mkdir -p /home/container && chown -R appuser:appuser /home/container
COPY --chmod=755 start-kokoro-altare.sh /usr/local/bin/start-kokoro-altare.sh
USER appuser
WORKDIR /home/container

EXPOSE 25715

# Run the packaged application independent of the Python egg's startup
# template and relative directories; this script selects SERVER_PORT.
ENTRYPOINT ["/bin/bash", "/usr/local/bin/start-kokoro-altare.sh"]
CMD []
