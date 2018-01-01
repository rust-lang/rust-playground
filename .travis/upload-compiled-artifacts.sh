#!/bin/bash

set -euv -o pipefail

if [[ ("${TRAVIS_PULL_REQUEST}" == "false") &&
          ("${TRAVIS_BRANCH}" == "master") &&
          (-n "${AWS_ACCESS_KEY_ID}") &&
          (-n "${AWS_SECRET_ACCESS_KEY}") ]]
then
    if [[ $BUILDING == backend ]]; then
        aws s3 cp --region=us-east-2 $HOME/cache/rust/target/x86_64-unknown-linux-musl/release/ui s3://playground-artifacts-i32
    else
        aws s3 sync --region=us-east-2 $TRAVIS_BUILD_DIR/ui/frontend/build/ s3://playground-artifacts-i32/build
    fi
fi
