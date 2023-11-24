#syntax=docker/dockerfile:1.5

FROM ubuntu:20.04 as toolchain

ARG channel

ENV DEBIAN_FRONTEND="noninteractive"

# `build-essential` and `file` are needed for backtrace-sys
# `cmake`, `git`, `python` are needed for wasm tools
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    curl \
    file \
    gcc \
    git \
    libssl-dev \
    pkg-config \
    python \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m playground -d /playground
RUN usermod -p '!!' root # Disable all passwords for root

# Attach the security note
COPY --chown=playground attach_notice.sh security_notice.txt /playground/
RUN /playground/attach_notice.sh /playground/security_notice.txt /etc/passwd && \
    /playground/attach_notice.sh /playground/security_notice.txt /etc/shadow && \
    rm -f /playground/attach_notice.sh

USER playground
ENV USER=playground
ENV PATH=/playground/.cargo/bin:$PATH
WORKDIR /playground

# Ensure that we are using the latest stable version of rustup and the
# latest version of the current channel. A new manifest will trigger
# these lines to run again, forcing a new download of rustup and
# installation of Rust.
ADD --chown=playground https://static.rust-lang.org/rustup/release-stable.toml /playground/tools/rustup-manifest.toml
ADD --chown=playground https://static.rust-lang.org/dist/channel-rust-${channel}-date.txt /playground/tools/rust-channel-version
RUN curl https://sh.rustup.rs -sSf | sh -s -- \
    -y \
    --profile minimal \
    --default-toolchain "${channel}" \
    --target wasm32-unknown-unknown \
    --component rustfmt \
    --component clippy

COPY --chown=playground entrypoint.sh /playground/tools/

# Build wasm-tools

FROM toolchain as wasm-tools

RUN cargo install wasm-tools

# Fetch all the crate source files

FROM toolchain as sources

RUN cargo init /playground

COPY --chown=playground Cargo.toml /playground/Cargo.toml
COPY --chown=playground crate-information.json /playground/crate-information.json
RUN cargo fetch

# Build our tool for modifying Cargo.toml at runtime

FROM toolchain as modify-cargo-toml

COPY --chown=playground modify-cargo-toml /playground/modify-cargo-toml
RUN cargo build --release --manifest-path=/playground/modify-cargo-toml/Cargo.toml

# Set up cargo-chef for faster builds

FROM toolchain as chef-available

RUN cargo install cargo-chef

WORKDIR /orchestrator

# Prepare the orchestrator's dependencies

FROM chef-available as prepare-orchestrator

COPY --chown=playground asm-cleanup /asm-cleanup
COPY --chown=playground modify-cargo-toml /modify-cargo-toml
COPY --chown=playground orchestrator /orchestrator
RUN cargo chef prepare

# Build the orchestrator

FROM chef-available as build-orchestrator

COPY --chown=playground asm-cleanup /asm-cleanup
COPY --chown=playground modify-cargo-toml /modify-cargo-toml
COPY --chown=playground --from=prepare-orchestrator /orchestrator/recipe.json /orchestrator/recipe.json
RUN cargo chef cook --release

COPY --chown=playground orchestrator /orchestrator
RUN cargo install --path .

# Compiler and pre-compiled crates

FROM sources

ARG channel

RUN cargo build
RUN cargo build --release
RUN cargo clippy
RUN rm src/*.rs

COPY --from=modify-cargo-toml /playground/modify-cargo-toml/target/release/modify-cargo-toml /playground/.cargo/bin
COPY --from=build-orchestrator /playground/.cargo/bin/worker /playground/.cargo/bin/worker
COPY --from=wasm-tools /playground/.cargo/bin/wasm-tools /playground/.cargo/bin
COPY --chown=playground cargo-wasm /playground/.cargo/bin/

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
