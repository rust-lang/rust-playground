#!/bin/bash
set -euv -o pipefail

if [-z ${DOCKER_USER}]
then
    echo "DOCKER_USER not specified"
    exit 1
else
    echo "Docker user: " $DOCKER_USER
fi

if [ -z ${DOCKER_PASSWORD} ]
then
    echo "No DOCKER_PASSWORD specified for ${DOCKER_USER}"
    exit 1
else
    echo "Docker password: ****"
fi

if [ -z ${DEPLOYMENT_ID} ];
then
    echo "DEPLOYMENT_ID not set"
    exit 1
else
    echo "Deployment ID: " $DEPLOYMENT_ID
fi

# Login to docker
echo ${DOCKER_PASSWORD} | docker login --username ${DOCKER_USER} --password-stdin

repository=${DOCKER_REGISTRY}

channels_to_build="${CHANNELS_TO_BUILD-stable beta nightly}"
tools_to_build="${TOOLS_TO_BUILD-rustfmt clippy miri}"

deployment_id="${DEPLOYMENT_ID}"

for channel in $channels_to_build; do
    cd "base"

    image_name="rust-${channel}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}" || true
    docker pull "${full_name}:munge" || true
    docker pull "${full_name}:sources" || true

    docker build -t "${full_name}:${deployment_id}" \
        --cache-from "${full_name}" \
        --cache-from "${full_name}:munge" \
        --cache-from "${full_name}:sources" \
        --build-arg channel="${channel}" \
        .

    docker push "${full_name}:${deployment_id}"

    cd ..
done

crate_api_base=https://crates.io/api/v1/crates

for tool in $tools_to_build; do
    cd "${tool}"

    image_name="${tool}"
    full_name="${repository}/${image_name}"

    docker pull "${full_name}" || true

    docker build -t "${full_name}:${deployment_id}" \
        --build-arg repository=${repository} \
        .

    docker push "${full_name}:${deployment_id}"
    
    cd ..
done
