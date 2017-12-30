FROM ubuntu:16.04

ENV USER=root
ADD https://download.docker.com/linux/static/stable/x86_64/docker-17.03.0-ce.tgz /
RUN cd /usr/bin/ && tar --strip-components=1 -xzf /docker-17.03.0-ce.tgz docker/docker
WORKDIR /ui
COPY ./target/x86_64-unknown-linux-musl/release/ui /ui/
COPY frontend/build /frontend
ENV TMPDIR=/mnt/playground \
    RUST_LOG=info \
    PLAYGROUND_UI_ADDRESS=0.0.0.0 \
    PLAYGROUND_UI_PORT=80 \
    PLAYGROUND_UI_ROOT=/frontend
ENTRYPOINT []
# Allow ctrl+C to work by wrapping the playground in bash
# (it will also perform process reaping). The odd construction
# is because if bash recognises a simple command it'll just
# exec it directly, so add a useless additional command.
CMD ["bash", "-c", "/ui/ui || false"]
