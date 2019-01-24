FROM shepmaster/rust-nightly:sources

RUN rustup component add clippy-preview

RUN cargo clippy
RUN rm src/*.rs

ENTRYPOINT ["/root/entrypoint.sh"]
