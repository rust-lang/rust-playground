#!/usr/bin/env bash

set -eu

function install_wasm_gc() {
    cargo install wasm-gc
}

(install_wasm_gc)
