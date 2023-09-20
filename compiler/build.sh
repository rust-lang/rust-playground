#!/bin/bash

set -euv -o pipefail

channels_to_build="${CHANNELS_TO_BUILD-stable beta nightly}"
tools_to_build="${TOOLS_TO_BUILD-rustfmt clippy miri}"

repository=shepmaster

for channel in $channels_to_build; do
    cd "base"

    image_name="rust-${channel}"
    full_name="${repository}/${image_name}"

    docker build -t "${full_name}" \
           --build-arg channel="${channel}" \
           .

    docker tag "${full_name}" "${image_name}"

    cd ..
done

crate_api_base=https://crates.io/api/v1/crates

for tool in $tools_to_build; do
    cd "${tool}"

    image_name="${tool}"
    full_name="${repository}/${image_name}"

    docker build -t "${full_name}" \
           .

    docker tag "${full_name}" "${image_name}"

    cd ..
done
