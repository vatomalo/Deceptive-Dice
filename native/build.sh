#!/bin/bash
set -eo pipefail
cd "$(dirname "$0")/.."
source /opt/steamlink-sdk/setenv.sh
set -e
root=$PWD/native
prefix=/tmp/dice-libs
mkdir -p "$prefix" native/build
export PKG_CONFIG_PATH="$prefix/lib/pkgconfig:$PKG_CONFIG_PATH"
export CFLAGS="-O2 -fPIC -I$prefix/include/pixman-1"
export pixman_CFLAGS="-I$prefix/include/pixman-1"
export pixman_LIBS="-L$prefix/lib -lpixman-1"
export LDFLAGS="-L$prefix/lib"
if [ ! -f "$prefix/lib/libpixman-1.a" ]; then
  mkdir -p /tmp/dice-pixman
  cd /tmp/dice-pixman
  "$root/deps/pixman-0.42.2/configure" --host=armv7a-cros-linux-gnueabi --prefix="$prefix" --disable-shared --disable-gtk --disable-libpng --disable-openmp --disable-loongson-mmi --disable-vmx
  make -j4
  make install
fi
if [ ! -f "$prefix/lib/libcairo.a" ]; then
  mkdir -p /tmp/dice-cairo
  cd /tmp/dice-cairo
  "$root/deps/cairo-1.16.0/configure" --host=armv7a-cros-linux-gnueabi --prefix="$prefix" --disable-shared --disable-xlib --disable-xcb --disable-ft --disable-fc --disable-png --disable-svg --disable-pdf --disable-ps --disable-script --disable-interpreter --disable-trace --disable-symbol-lookup --disable-gobject
  make -j4
  make install
fi
cd "$root/.."
q=native/vendor
$CXX -O2 -std=c++11 -fno-exceptions -fno-rtti -c native/game_core.cpp -o native/build/game_core.o
$CXX -O2 -std=c++11 -fno-exceptions -fno-rtti native/core-test.cpp native/build/game_core.o -o native/build/core-test-arm
$CC -O2 -D_GNU_SOURCE -DCONFIG_VERSION=\"2025-09-13\" -I"$q" -I"$prefix/include/cairo" $(pkg-config --cflags sdl2) native/runtime.c native/build/game_core.o "$q/quickjs.c" "$q/libregexp.c" "$q/libunicode.c" "$q/cutils.c" "$q/dtoa.c" -o native/build/deceptive-dice $(pkg-config --libs sdl2) -lSDL2_image -lSDL2_ttf -lSDL2_mixer "$prefix/lib/libcairo.a" "$prefix/lib/libpixman-1.a" -lm -lpthread -ldl
$STRIP native/build/deceptive-dice
file native/build/deceptive-dice
