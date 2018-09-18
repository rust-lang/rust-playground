#!/bin/bash

set -euv -o pipefail

# Use docker to build a linux version of the GUI. We do this by mounting the UI source into a node-based container
# and running `yarn run build`
cd frontend
docker pull "node:10"
rm -fr build
rm -fr node_modules
docker run -it --rm -v $PWD:/ui --workdir /ui --entrypoint /bin/bash node -c '
    yarn &&
    NODE_ENV=production yarn run build
'