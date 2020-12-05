ARG base_image=shepmaster/rust-nightly:sources
FROM ${base_image}

RUN rustup component add clippy-preview

RUN cargo clippy
RUN rm src/*.rs

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
