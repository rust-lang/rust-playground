FROM shepmaster/rust-nightly

RUN rustup component add clippy-preview

# TODO: Now that Clippy uses `cargo check`, we don't need to build on
# top of the nightly image with pre-built crates. Evaluate if it's
# worth it to split up the builds.
RUN echo 'fn main() {}' > src/main.rs && \
    cargo clippy && \
    rm src/main.rs

ENTRYPOINT ["/root/entrypoint.sh"]
