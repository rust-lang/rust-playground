FROM rust-base

ARG date
RUN rustup default "beta-${date}"

RUN cd / && \
    cargo new --bin playground

WORKDIR /playground

RUN mv /root/Cargo.toml ./Cargo.toml && \
    cargo build && \
    cargo build --release

RUN find . -name '*.json' -print0 | xargs -0 -n1 /root/fix-modification-time.sh

ENTRYPOINT ["/root/entrypoint.sh"]
