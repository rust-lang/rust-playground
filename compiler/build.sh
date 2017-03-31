#!/bin/bash

set -eu -o pipefail

cd base
docker build -t 'rust-base' .
cd ..

date_url_base=https://static.rust-lang.org/dist

for channel in stable beta nightly; do
    filename="channel-rust-${channel}-date.txt"

    cd "$channel"

    curl -o "${filename}" "${date_url_base}/${filename}"
    date=$(cat "${filename}")

    docker build -t "rust-${channel}" --build-arg date="${date}" .

    cd ..
done

crate_api_base=https://crates.io/api/v1/crates

for tool in rustfmt clippy; do
    filename="version-${tool}.txt"

    cd "${tool}"

    curl -o "${filename}" "${crate_api_base}/${tool}"
    version=$(jq -r '.crate.max_version' "${filename}")

    docker build -t "${tool}" --build-arg version="${version}" .

    cd ..
done
