#!/bin/bash

set -euv -o pipefail

repository=$1
tools=${TOOLS-rust-stable rust-beta rust-nightly rustfmt clippy miri}

for image in ${tools}; do
    docker pull "${repository}/${image}"
    # The backend expects images without a repository prefix
    docker tag "${repository}/${image}" "${image}"
done
