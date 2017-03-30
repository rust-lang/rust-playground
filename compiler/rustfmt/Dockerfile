FROM rust-stable

ARG version

RUN cargo install rustfmt --vers "${version}"
ENTRYPOINT ["rustfmt"]
