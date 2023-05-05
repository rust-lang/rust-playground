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
ADD --chown=playground attach_notice.sh security_notice.txt /playground/
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
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain "${channel}"

ADD --chown=playground entrypoint.sh /playground/tools/

# Fetch all the crate source files

FROM toolchain as bare-sources

RUN cargo init /playground

ADD --chown=playground Cargo.toml /playground/Cargo.toml
ADD --chown=playground crate-information.json /playground/crate-information.json
RUN cargo fetch

# Build our tool for modifying Cargo.toml at runtime

FROM bare-sources as munge

ADD --chown=playground modify-cargo-toml /playground/modify-cargo-toml
RUN cargo build --release --manifest-path=/playground/modify-cargo-toml/Cargo.toml

# Compiler and sources

FROM bare-sources as sources

COPY --from=munge /playground/modify-cargo-toml/target/release/modify-cargo-toml /playground/.cargo/bin

# Compiler and pre-compiled crates

FROM sources

ARG channel

RUN cargo build
RUN cargo build --release
RUN rm src/*.rs

ADD --chown=playground postinstall.sh /playground/tools/
RUN /playground/tools/postinstall.sh ${channel}
ADD --chown=playground cargo-wasm /playground/.cargo/bin/

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
