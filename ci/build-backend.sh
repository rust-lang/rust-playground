#!/usr/bin/env bash

set -eu

IMAGE_NAME=backend-build
OUTPUT_DIR=docker-output

docker build \
       --tag "${IMAGE_NAME}" \
       --file ci/Dockerfile \
       --target output \
       --output "${OUTPUT_DIR}" \
       .
