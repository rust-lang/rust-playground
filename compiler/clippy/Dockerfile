ARG base_image=shepmaster/rust-nightly
FROM ${base_image}

RUN rustup component add clippy

RUN touch src/lib.rs
RUN cargo clippy
RUN rm src/*.rs

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
