#!/bin/bash

set -euv -o pipefail

docker \
    run \
    -it \
    --rm \
    -v $PWD/ui/frontend:/ui \
    -v $HOME/cache/node/node_modules:/ui/node_modules \
    -v $HOME/cache/node/yarn-cache:/root/.yarn-cache \
    --workdir /ui \
    node:12.13 \
    bash -c 'yarn && \
             yarn test && \
             yarn test:lint && \
             yarn run build:production'
