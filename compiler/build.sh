#!/bin/bash

repository=${DOCKER_REGISTRY}

set -euv -o pipefail

channels_to_build="${CHANNELS_TO_BUILD-stable beta nightly}"
tools_to_build="${TOOLS_TO_BUILD-rustfmt clippy miri}"

for channel in $channels_to_build; do
    cd "base"

    image_name="rust-${channel}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}" || true
    docker pull "${full_name}:munge" || true
    docker pull "${full_name}:sources" || true

    docker build -t "${full_name}" \
        --cache-from "${full_name}" \
        --cache-from "${full_name}:munge" \
        --cache-from "${full_name}:sources" \
        --build-arg channel="${channel}" \
        .

    docker tag "${full_name}" "${image_name}"

    docker image save -o ${full_name} ${image_name}

    cd ..
done

crate_api_base=https://crates.io/api/v1/crates

for tool in $tools_to_build; do
    cd "${tool}"

    image_name="${tool}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}" || true

    docker build -t "${full_name}" \
        --build-arg repository=${repository} \
        .

    docker tag "${full_name}" "${image_name}"

    docker image save -o ${full_name} ${image_name}
    cd ..
done
