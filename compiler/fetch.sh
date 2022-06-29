#!/bin/bash

set -euv -o pipefail

repository=$1
tools=${TOOLS-rust-stable rust-beta rust-nightly rustfmt clippy miri}
deployment_id = ${DEPLOYMENT_ID}

if [ -z ${deployment_id} ];
then
    echo "DEPLOYMENT_ID not set"
    exit 1
else
    echo "Deployment ID: " $deployment_id
fi

for image in ${tools}; do
    docker pull "${repository}/${image}:${deployment_id}"
    # The backend expects images without a repository prefix
    docker tag "${repository}/${image}:${deployment_id}" "${image}"
done
