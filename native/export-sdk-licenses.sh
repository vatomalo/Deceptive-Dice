#!/bin/bash
set -e
out=/src/native/build/sdk-licenses
mkdir -p "$out"
cd /opt/steamlink-sdk
for dir in external/SDL2_image-2.0.6 external/SDL2_ttf-2.20.1 external/SDL2_mixer-2.0.2 external/jpeg-9b external/libpng-1.6.19 external/libogg-1.3.2 external/libvorbis-1.3.5; do
    name=$(basename "$dir")
    for file in COPYING COPYING.txt LICENSE LICENSE.txt README libpng-LICENSE.txt; do
        if [ -f "$dir/$file" ]; then cp "$dir/$file" "$out/$name-$file"; fi
    done
done
find . -name SDL_license.h -o -name SDL_stdinc.h | head -1 | while read -r file; do head -n 25 "$file" > "$out/SDL2.txt"; done
git rev-parse HEAD > "$out/Valve-SDK-revision.txt"
