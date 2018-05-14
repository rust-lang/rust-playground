#!/bin/bash

set -euv -o pipefail

if [[ ("${TRAVIS_PULL_REQUEST}" == "false") &&
          ("${TRAVIS_BRANCH}" == "master") &&
          (-n "${DOCKER_USERNAME}") &&
          (-n "${DOCKER_PASSWORD}") ]]
then
    echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin
    export PERFORM_PUSH="true"
    # Which images to build are set via .travis.yml
    cd compiler && ./build.sh
fi
