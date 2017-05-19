#!/bin/bash

set -euv -o pipefail

if [[ ("${TRAVIS_PULL_REQUEST}" == "false") &&
          ("${TRAVIS_BRANCH}" == "master") &&
          (-n "${AWS_ACCESS_KEY_ID}") &&
          (-n "${AWS_SECRET_ACCESS_KEY}") ]]
then
    if [[ $BUILDING == backend ]]; then
        aws s3 cp $HOME/cache/rust/target/x86_64-unknown-linux-musl/release/ui s3://playground-artifacts
    else
        aws s3 sync $TRAVIS_BUILD_DIR/ui/frontend/build/ s3://playground-artifacts/build
    fi
fi
