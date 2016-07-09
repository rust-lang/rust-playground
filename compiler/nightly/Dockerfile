FROM rust-base

ARG date
RUN rustup default "nightly-${date}"

RUN cd / && \
    cargo new --bin playground

WORKDIR /playground

RUN mv /root/Cargo.toml ./Cargo.toml && \
    cargo build && \
    cargo build --release

ENTRYPOINT ["/root/entrypoint.sh"]
