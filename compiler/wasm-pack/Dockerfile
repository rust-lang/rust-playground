# syntax = docker/dockerfile:experimental

# fetch dependencies to local
FROM shepmaster/rust-nightly as sources
RUN cargo install wasm-pack
ADD --chown=playground src/lib.rs /playground/src/lib.rs
# TODO support top 100 crates
ADD --chown=playground Cargo.toml /playground/Cargo.toml
RUN cargo fetch

# build dependencies
FROM sources
RUN wasm-pack build --target web --out-name package --dev
RUN rm src/*.rs

ADD --chown=playground cargo-pack /playground/.cargo/bin/
ENTRYPOINT ["/playground/tools/entrypoint.sh"]
