#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
for frames in 60 160 420; do
  SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy native/build/deceptive-dice-host \
    --frames "$frames" --seed 42 --smoke --screenshot "native/build/sprite-native-$frames.bmp" \
    >"native/build/sprite-native-$frames.log" 2>&1
  DICE_REFERENCE_SPRITES=1 DICE_DISABLE_BATCH=1 SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy \
    native/build/deceptive-dice-host --frames "$frames" --seed 42 --smoke \
    --screenshot "native/build/sprite-reference-$frames.bmp" >"native/build/sprite-reference-$frames.log" 2>&1
  cmp "native/build/sprite-native-$frames.bmp" "native/build/sprite-reference-$frames.bmp"
  echo "Sprite render parity: $frames frames, pixel-identical"
done
