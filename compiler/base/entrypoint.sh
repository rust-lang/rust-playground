#!/bin/bash

set -eu

timeout=${PLAYGROUND_TIMEOUT:-10}

modify-cargo-toml
timeout --signal=KILL ${timeout} "$@"
