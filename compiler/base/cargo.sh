#!/bin/bash

set -eu

POSITIONAL=()

while [[ $# -gt 0 ]]; do
        case $1 in
                --env)
                        export $2
                        shift 2
                        ;;
                *)
                        POSITIONAL+=("$1")
                        shift
                        ;;
        esac
done

eval set -- "${POSITIONAL[@]}"

timeout=${PLAYGROUND_TIMEOUT:-10}

modify-cargo-toml

timeout --signal=KILL ${timeout} cargo "$@" || pkill sleep

pkill sleep
