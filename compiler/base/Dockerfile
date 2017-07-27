FROM ubuntu:16.04

# `build-essential` and `file` is needed for backtrace-sys
# https://github.com/alexcrichton/backtrace-rs/issues/26
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    file \
    gcc \
    jq \
    libssl-dev \
 && rm -rf /var/lib/apt/lists/*

ENV USER=root
ENV PATH=/root/.cargo/bin:$PATH

ADD entrypoint.sh /root/
ENTRYPOINT ["/root/entrypoint.sh"]

ARG channel

# Ensure that we are using the latest stable version of rustup and the
# latest version of the current channel. A new manifest will trigger
# these lines to run again, forcing a new download of rustup and
# installation of Rust.
ADD https://static.rust-lang.org/rustup/release-stable.toml /root/rustup-manifest.toml
ADD https://static.rust-lang.org/dist/channel-rust-${channel}-date.txt /root/rust-channel-version

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain "${channel}"

RUN cd / && \
    cargo new playground
WORKDIR /playground

ADD Cargo.toml /playground/Cargo.toml
RUN cargo build
RUN cargo build --release
RUN rm src/*.rs

ADD crate-information.json /playground/crate-information.json
