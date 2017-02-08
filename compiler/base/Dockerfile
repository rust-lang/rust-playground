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
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y  && rustup toolchain uninstall stable
ADD Cargo.toml /root/Cargo.toml
ADD entrypoint.sh /root/
ADD fix-modification-time.sh /root/
