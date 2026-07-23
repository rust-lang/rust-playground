#!/usr/bin/env bash

set -eu

IMAGE_NAME=backend-build
OUTPUT_DIR=docker-output
CACHE_FILE="${OUTPUT_DIR}/cache.tar"

if [[ -v CACHE_IMPORT_EXPORT ]]; then
    if [[ -f "${CACHE_FILE}" ]]; then
        echo "Importing cache from '${CACHE_FILE}'"
        docker buildx build \
               --file ci/Dockerfile \
               --target cache-import \
               --build-context cache="${OUTPUT_DIR}" \
               --output type=cacheonly \
               .
    else
        echo "Cache file '${CACHE_FILE}' not found, assuming fresh build"
    fi
fi

docker buildx build \
       --tag "${IMAGE_NAME}" \
       --file ci/Dockerfile \
       --target output \
       --output "${OUTPUT_DIR}" \
       .

if [[ -v CACHE_IMPORT_EXPORT ]]; then
    echo "Exporting cache to '${CACHE_FILE}'"
    docker buildx build \
           --file ci/Dockerfile \
           --target cache-export \
           --output "${OUTPUT_DIR}" \
           .
fi
