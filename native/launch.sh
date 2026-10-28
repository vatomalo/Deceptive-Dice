#!/bin/sh
set -eu
cd "$(dirname "$0")"
export LD_LIBRARY_PATH="$PWD/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
if [ "$#" -eq 0 ]; then
    exec ./deceptive-dice
fi
exec ./deceptive-dice "$@"
