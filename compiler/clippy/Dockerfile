FROM shepmaster/rust-nightly

ARG version

RUN cargo install clippy --vers "${version}"

# TODO: Now that Clippy uses `cargo check`, we don't need to build on
# top of the nightly image with pre-built crates. Evaluate if it's
# worth it to split up the builds.
RUN echo 'fn main() {}' > src/main.rs && \
    cargo clippy && \
    rm src/main.rs
