#!/bin/bash

set -euv -o pipefail

cache_dir=${CACHE_DIR:-$HOME/cache}

docker \
    run \
    -it \
    --rm \
    -v $PWD/ui:/ui \
    -v $cache_dir/rust/cargo/git:/home/rust/.cargo/git \
    -v $cache_dir/rust/cargo/registry:/home/rust/.cargo/registry \
    -v $cache_dir/rust/target:/ui/target \
    --workdir /ui \
    ekidd/rust-musl-builder:stable \
    bash -c 'sudo chown -R rust:rust /home/rust/.cargo /ui/target; \
             cargo build --locked --target=x86_64-unknown-linux-musl --release'
