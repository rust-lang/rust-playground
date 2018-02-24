#!/bin/bash

set -euv -o pipefail

docker \
    run \
    -it \
    --rm \
    -v $PWD/ui:/ui \
    -v $HOME/cache/rust/cargo/git:/root/.cargo/git \
    -v $HOME/cache/rust/cargo/registry:/root/.cargo/registry \
    -v $HOME/cache/rust/target:/ui/target \
    --workdir /ui \
    mackeyja92/rustup \
    bash -c 'rustup install nightly && \
             rustup default nightly && \
             rustup target add x86_64-unknown-linux-musl && \
             cargo build --locked --target=x86_64-unknown-linux-musl --release'
