#!/bin/bash

set -euv -o pipefail

repository=shepmaster

for image in rust-stable rust-beta rust-nightly rustfmt clippy; do
    docker pull "${repository}/${image}"
    # The backend expects images without a respoitory prefix
    docker tag "${repository}/${image}" "${image}"
done
