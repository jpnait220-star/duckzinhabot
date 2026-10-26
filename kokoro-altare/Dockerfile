# Kokoro CPU adapted to the Pterodactyl/Altare container lifecycle.
# Wings runs the container with /home/container mounted, and the image
# needs a CMD that starts the service rather than the stock /app-relative one.
FROM ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0

ENV HOST=0.0.0.0 \
    PORT=25715 \
    DOWNLOAD_MODEL=false \
    TEMP_FILE_DIR=/tmp/duckzinha-kokoro \
    PYTHONPATH=/app:/app/api \
    HOME=/home/container \
    USER=container

USER root
RUN mkdir -p /home/container && chmod 755 /home/container
COPY --chmod=755 start-kokoro-altare.sh /entrypoint.sh

# Wings sets the effective runtime user (uid differs across hosts).
# Do not depend on the static upstream "appuser" account.
WORKDIR /home/container

EXPOSE 25715

# Use the same CMD convention as Pterodactyl's official yolk images.
# No explicit ENTRYPOINT; the upstream Kokoro image has none.
CMD ["/bin/bash", "/entrypoint.sh"]
