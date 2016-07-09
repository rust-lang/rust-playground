#!/bin/bash

set -eu

timeout=${PLAYGROUND_TIMEOUT:-10}

timeout --signal=KILL ${timeout} "$@"
