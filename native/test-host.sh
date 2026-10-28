#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p native/build
g++ -O2 -std=c++11 -fno-exceptions -fno-rtti native/game_core.cpp native/core-test.cpp -o native/build/core-test
native/build/core-test
g++ -O2 -std=c++11 -fno-exceptions -fno-rtti -c native/game_core.cpp -o native/build/game_core-host.o
q=native/vendor
gcc -O2 -D_GNU_SOURCE -DCONFIG_VERSION=\"2025-09-13\" -I"$q" $(pkg-config --cflags sdl2 cairo SDL2_image SDL2_ttf SDL2_mixer) native/runtime.c native/build/game_core-host.o "$q/quickjs.c" "$q/libregexp.c" "$q/libunicode.c" "$q/cutils.c" "$q/dtoa.c" -o native/build/deceptive-dice-host $(pkg-config --libs sdl2 cairo SDL2_image SDL2_ttf SDL2_mixer) -lm -lpthread -ldl
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy native/build/deceptive-dice-host --frames 420 --seed 42 --smoke --profile
node native/test-timing.js
