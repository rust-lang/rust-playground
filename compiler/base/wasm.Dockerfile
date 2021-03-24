FROM rust as planner
WORKDIR /playground
RUN rustup update && rustup toolchain install nightly && rustup default nightly && \
    rustup target add wasm32-unknown-unknown --toolchain nightly

RUN cargo +nightly install wasm-bindgen-cli && cargo +nightly install wasm-gc

RUN cargo install wasm-pack cargo-chef

RUN git clone https://github.com/yewstack/yew-wasm-pack-minimal.git .
RUN cargo chef prepare  --recipe-path recipe.json

# We only pay the installation cost once,
# it will be cached from the second build onwards
# COPY . .
FROM planner as cacher
WORKDIR /playground
RUN cargo install cargo-chef
COPY --from=planner /playground/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

FROM planner as builder
WORKDIR /playground
# COPY . .
# RUN git clone https://github.com/yewstack/yew-wasm-pack-minimal.git .
# Copy over the cached dependencies
COPY --from=cacher /playground/target target
COPY --from=cacher $CARGO_HOME $CARGO_HOME
#RUN cargo build --release
RUN wasm-pack build --target web --out-name wasm --mode no-install -- --offline

