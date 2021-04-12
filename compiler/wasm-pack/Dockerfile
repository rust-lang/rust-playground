# syntax = docker/dockerfile:experimental

FROM shepmaster/rust-nightly
RUN cargo install wasm-pack
ADD --chown=playground src/lib.rs /playground/src/lib.rs
ADD --chown=playground Cargo.toml /playground/Cargo.toml
RUN    cargo vendor --no-delete --versioned-dirs ./cargo-deps > /playground/.cargo/config.toml \
    && wasm-pack build --target web --out-name package --dev \
    && wasm-pack build --target web --out-name package 
RUN rm src/lib.rs

ADD --chown=playground cargo-pack /playground/.cargo/bin/
ADD --chown=playground entrypoint.sh /playground/tools/
ENTRYPOINT ["/playground/tools/entrypoint.sh"]
