#!/bin/bash
repository=taridocker
image_name="rust-playground"
full_name="${repository}/${image_name}"

# Build a linux version of playground with the UI code we've just built added in (see the Dockerfile)

if [ x$1 = ximage ]; then
    docker pull "${full_name}" || true # not on docker hub...yet
    docker build -t "${full_name}" --cache-from "${full_name}" .
fi

if [ x$1 = xpush ]; then
    docker tag "${full_name}" "${image_name}"
    docker push "${full_name}"
fi