# syntax = docker/dockerfile:experimental

FROM shepmaster/rust-nightly
RUN cargo install wasm-pack
ADD --chown=playground src/lib.rs /playground/src/lib.rs
ADD --chown=playground Cargo.toml /playground/Cargo.toml
# RUN --mount=target=/playground/target,type=cache,mode=0777 \
#     --mount=target=/playground/cargo-deps,type=cache,mode=0777 \
RUN    cargo vendor --no-delete --versioned-dirs ./cargo-deps > /playground/.cargo/config.toml \
 && wasm-pack build --target web --out-name package --dev \
 && wasm-pack build --target web --out-name package \
 && cp --preserve=timestamps -r /playground/cargo-deps /playground/cargo-deps-cached \
 && cp --preserve=timestamps -r /playground/target /playground/target-cached 
RUN rm -r /playground/cargo-deps && mv /playground/cargo-deps-cached /playground/cargo-deps
RUN rm -r /playground/target && mv /playground/target-cached /playground/target
# ADD --chown=playground config.toml /playground/.cargo/config.toml
# RUN rm src/component.rs

ADD --chown=playground cargo-pack /playground/.cargo/bin/
ADD --chown=playground entrypoint.sh /playground/tools/
ENTRYPOINT ["/playground/tools/entrypoint.sh"]
