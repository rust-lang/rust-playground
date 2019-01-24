#!/bin/bash

set -euv -o pipefail

channels_to_build="${CHANNELS_TO_BUILD-stable beta nightly}"
tools_to_build="${TOOLS_TO_BUILD-rustfmt clippy miri}"
perform_push="${PERFORM_PUSH-false}"

repository=shepmaster

for channel in $channels_to_build; do
    cd "base"

    image_name="rust-${channel}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}" || true
    docker pull "${full_name}:munge" || true

    # Prevent building the tool multiple times
    # https://github.com/moby/moby/issues/34715
    docker build -t "${full_name}:munge" \
           --target munge \
           --cache-from "${full_name}" \
           --cache-from "${full_name}:munge" \
           --build-arg channel="${channel}" \
           .

    docker build -t "${full_name}:sources" \
           --target sources \
           --cache-from "${full_name}" \
           --cache-from "${full_name}:munge" \
           --build-arg channel="${channel}" \
           .

    docker build -t "${full_name}" \
           --cache-from "${full_name}" \
           --cache-from "${full_name}:munge" \
           --build-arg channel="${channel}" \
           .

    docker tag "${full_name}" "${image_name}"

    if [[ "${perform_push}" == 'true' ]]; then
        docker push "${full_name}:munge"
        docker push "${full_name}:sources"
        docker push "${full_name}"
    fi

    cd ..
done

crate_api_base=https://crates.io/api/v1/crates

for tool in $tools_to_build; do
    cd "${tool}"

    image_name="${tool}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}" || true
    docker build -t "${full_name}" \
           .

    docker tag "${full_name}" "${image_name}"

    if [[ "${perform_push}" == 'true' ]]; then
        docker push "${full_name}"
    fi

    cd ..
done
