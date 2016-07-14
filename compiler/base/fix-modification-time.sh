#!/bin/bash

set -eu -o pipefail

# The docker filesystem layers (at least AUFS) preserve
# nanosecond-level granularity while the container is running, but
# lose that granularity when the image is saved.
#
# This causes spurious rebuilds of any crate that uses file
# modification-based timestamps, as the time appears to have
# changed. See https://github.com/rust-lang/cargo/issues/2874 for some
# further details.
#
# As a terrible, nasty hack, let's just rewrite the fingerprint files
# to set the nanosecond value to 0, matching the filesystem. This
# relies on the unstable internals of the JSON cache files, so this is
# likely quite brittle.

t=$(mktemp)
jq 'if .local.variant == "MtimeBased" then .local.fields[0][1] |= 0 else . end' "$1" > "$t"
mv "$t" "$1"
