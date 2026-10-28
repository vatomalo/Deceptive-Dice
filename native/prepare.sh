#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
fetch() {
    local url=$1 sha=$2 name=$3 dest=$4
    mkdir -p "$dest"
    curl -fLsS "$url" -o "$name"
    printf '%s  %s\n' "$sha" "$name" | sha256sum -c -
    tar xf "$name" -C "$dest" --strip-components=1
    rm "$name"
}
fetch https://bellard.org/quickjs/quickjs-2025-09-13-2.tar.xz 996c6b5018fc955ad4d06426d0e9cb713685a00c825aa5c0418bd53f7df8b0b4 quickjs.tar.xz vendor
fetch https://cairographics.org/releases/pixman-0.42.2.tar.gz ea1480efada2fd948bc75366f7c349e1c96d3297d09a3fe62626e38e234a625e pixman.tar.gz deps/pixman-0.42.2
fetch https://cairographics.org/releases/cairo-1.16.0.tar.xz 5e7b29b3f113ef870d1e3ecf8adf21f923396401604bda16d44be45e66052331 cairo.tar.xz deps/cairo-1.16.0
