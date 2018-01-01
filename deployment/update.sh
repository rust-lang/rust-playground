#!/bin/bash

set -euv -o pipefail

root=/home/ubuntu

# Get new docker images
$root/rust-playground/compiler/fetch.sh

# Clean old docker images
docker system prune -f || true

# Get new artifacts
aws s3 sync s3://playground-artifacts $root/playground-artifacts
# These artifacts don't change names and might stay the same size
# https://github.com/aws/aws-cli/issues/1074
aws s3 sync \
    --exclude='*' \
    --include=ui \
    --include=build/index.html \
    --include=build/robots.txt \
    --exact-timestamps \
    s3://playground-artifacts $root/playground-artifacts
chmod +x $root/playground-artifacts/ui

# Restart to get new server binary
sudo service playground stop || true
sudo service playground start
