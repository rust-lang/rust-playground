ARG base_image=shepmaster/rust-nightly
FROM ${base_image}

RUN rustup component add rust-src miri

RUN echo 'fn main() {}' > src/main.rs
RUN cargo miri setup
RUN cargo miri run
RUN rm src/*.rs

ADD --chown=playground cargo-miri-playground /playground/.cargo/bin

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
