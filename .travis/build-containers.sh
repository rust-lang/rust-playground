#!/bin/bash

set -euv -o pipefail

if [[ ("${TRAVIS_PULL_REQUEST}" == "false") &&
          ("${TRAVIS_BRANCH}" == "master") &&
          (-n "${DOCKER_USERNAME}") &&
          (-n "${DOCKER_PASSWORD}") ]]
then
    docker login -u="${DOCKER_USERNAME}" -p="${DOCKER_PASSWORD}"
    export PERFORM_PUSH="true"
    # Which images to build are set via .travis.yml
    cd compiler && ./build.sh && cd ..
    cd ui && ./build.sh && cd ..
fi
