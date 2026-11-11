#!/bin/bash

set -eu

env_path=/playground/tools/miri-environment
[ -f "${env_path}" ] && source "${env_path}"

exec "$@"
