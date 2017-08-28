#!/bin/bash

set -euv -o pipefail

channels_to_build="${CHANNELS_TO_BUILD-stable beta nightly}"
tools_to_build="${TOOLS_TO_BUILD-rustfmt clippy}"
perform_push="${PERFORM_PUSH-false}"

repository=shepmaster

for channel in $channels_to_build; do
    cd "base"

    image_name="rust-${channel}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}"
    docker build -t "${full_name}" \
           --cache-from "${full_name}" \
           --build-arg channel="${channel}" \
           .
    docker tag "${full_name}" "${image_name}"

    if [[ "${perform_push}" == 'true' ]]; then
        docker push "${full_name}"
    fi

    cd ..
done

crate_api_base=https://crates.io/api/v1/crates

for tool in $tools_to_build; do
    cd "${tool}"

    crate_name="${tool}"
    if [[ "${tool}" == 'rustfmt' ]]; then
        crate_name=rustfmt-nightly
    fi

    filename="version-${tool}.txt"
    curl -o "${filename}" "${crate_api_base}/${crate_name}"
    version=$(jq -r '.crate.max_version' "${filename}")

    image_name="${tool}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}"
    docker build -t "${full_name}" \
           --cache-from "${full_name}" \
           --build-arg version="${version}" \
           .
    docker tag "${full_name}" "${image_name}"

    if [[ "${perform_push}" == 'true' ]]; then
        docker push "${full_name}"
    fi

    cd ..
done
