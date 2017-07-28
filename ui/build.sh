#!/bin/bash

set -euv -o pipefail

perform_push="${PERFORM_PUSH-false}"

repository=shepmaster

# Build outside the image so nodejs isn't installed on the main image
cd frontend
docker pull node
docker run -it --rm -v $PWD:/ui --workdir /ui --entrypoint /bin/bash node -c '
    yarn &&
    NODE_ENV=production yarn run build
'
cd ..

# Also don't put a rust compiler in the main playground image
docker run -it --rm -v $PWD:/ui --workdir /ui --entrypoint /bin/bash shepmaster/rust-nightly -c '
    rustup target add x86_64-unknown-linux-musl &&
    cargo build --target=x86_64-unknown-linux-musl --release
'

image_name="playground"
full_name="${repository}/${image_name}"
docker pull "${full_name}" || true # not on docker hub...yet
docker build -t "${full_name}" \
       --cache-from "${full_name}" \
       .
docker tag "${full_name}" "${image_name}"
if [[ "${perform_push}" == 'true' ]]; then
    docker push "${full_name}"
fi
