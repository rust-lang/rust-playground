#!/bin/bash

set -eu -o pipefail

base=https://static.rust-lang.org/dist

for channel in stable beta nightly; do
    filename="channel-rust-${channel}-date.txt"

    cd "$channel"

    curl -o "${filename}" "${base}/${filename}"
    date=$(cat "${filename}")

    docker build -t "rust-${channel}" --build-arg date="${date}" .

    cd ..
done

for tool in rustfmt; do
    cd "${tool}"
    docker build -t "${tool}" .
    cd ..
done
