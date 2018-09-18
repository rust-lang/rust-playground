FROM ubuntu:18.04 as toolchain

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
    musl-tools \
 && rm -rf /var/lib/apt/lists/*

ENV USER=root
ENV PATH=/root/.cargo/bin:$PATH

ADD entrypoint.sh /root/

ARG channel

# Ensure that we are using the latest stable version of rustup and the
# latest version of the current channel. A new manifest will trigger
# these lines to run again, forcing a new download of rustup and
# installation of Rust.
ADD https://static.rust-lang.org/rustup/release-stable.toml /root/rustup-manifest.toml
ADD https://static.rust-lang.org/dist/channel-rust-${channel}-date.txt /root/rust-channel-version

# https://github.com/rust-lang-nursery/rustup.rs/issues/998
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain "${channel}" && \
    rm -rf ~/.rustup/toolchains/*/share/doc

# Prebuild the playground's dependencies

FROM toolchain as dependencies

RUN cd / && \
    cargo new playground
WORKDIR /playground

ADD Cargo.toml /playground/Cargo.toml
#RUN cargo fetch
#RUN cargo build
RUN cargo build --release
RUN rm src/*.rs

# Build our tool for modifying Cargo.toml at runtime

FROM dependencies as munge

ADD modify-cargo-toml /modify-cargo-toml
RUN cd /modify-cargo-toml && \
    cargo build --release

# Put everything together

FROM dependencies

ENTRYPOINT ["/root/entrypoint.sh"]

ARG channel

ADD crate-information.json /playground/crate-information.json

ADD postinstall.sh /root/
RUN /root/postinstall.sh ${channel}
ADD cargo-wasm /root/.cargo/bin/
COPY --from=munge /modify-cargo-toml/target/release/modify-cargo-toml /root/.cargo/bin
