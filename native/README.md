# Deceptive Dice for Steam Link hardware

Experimental ARMv7 port of the original game. QuickJS runs the combat engine;
the visible Canvas is rendered by SDL/OpenGL ES on the GPU. Particle updates
and drawing use native batches. Cairo/Pixman handle offscreen pixel operations
used for asset preparation. No PC streaming is required.

The game's original **640×360 coordinates and layout are preserved**. The
completed frame is upscaled to a supported 960×540 display surface and then to
the television by the Steam Link. Actor, HUD and action-button coordinates are
unchanged. `DICE_DISPLAY_RESOLUTION=1280x720` selects the larger backing surface
if needed. A 640×360 backing surface is rejected by the tested firmware, so the
game uses a 640×360 render texture instead.

## Controls

- A / Cross: roll or attack. B / Circle: pass.
- LB / RB: previous / next stance.
- Back / Select: materia. D-pad up/down selects an item; left/right selects a
  slot; A equips or unequips; B closes the menu.
- Back + Start together: exit to FlXtR.
- Keyboard: Z roll, X attack, C pass, M materia, Escape exit.

FlXtR's Games folder contains **DECEPTIVE DICE**. Press A to install the pinned,
SHA-256-verified release on first launch. Later launches work offline. Exiting
returns to FlXtR. A standalone install may extract this archive into
`/home/apps/` and run `/home/apps/deceptive-dice/launch.sh`.

## Validation and limits

The ARM binary is built with Valve's SDK and tested on physical Steam Link
hardware. Tests cover original layout coordinates, controller/QTE input, a
completed combat round, and parity between native and JavaScript particle
updates. Frame-rate measurements include a seeded combat sequence and exclude
the first 60 warmup frames. They are workload measurements, not a promise for
every scene. Audible sound and extended manual play still need validation.
This preview does not add saved-game support. The bundled DejaVu font replaces
browser font selection, and a small pixel heart replaces an absent source icon.

Run `node native/test-timing.js` for elapsed-time animation and effect tests.
On-device rendering/input/combat checks:

```
./deceptive-dice --frames 420 --seed 42 --smoke --profile
```

The GPU caches text and textures and clips transparent sprite regions into
small batches. No weather/grass density is removed. Simulation uses elapsed
time, so lower presentation rates do not slow animation, stamina or weather.
Blink timing is independent of rendered frames; expired shadow clones are
removed rather than accumulating during play.

## Build

The C++ migration starts in `native/game_core.cpp`, with a C ABI that has no
SDL or JavaScript dependency. It owns both stamina pools, passive regeneration,
stance costs/refunds, damage formulas and agility probabilities. The temporary
`core-bridge.js` adapter connects the existing UI and combat events to that state.
Battle sequencing, progression, dice animation and much of the presentation
still use JavaScript; this is the first migration milestone.

Run `bash native/test-host.sh` on Linux with SDL development libraries installed.
It runs the standalone C++ tests, 3,040 comparisons against the original loaded
JavaScript methods, the combat smoke test, and elapsed-time animation checks.
The SDK build also produces `native/build/core-test-arm` for device validation.

Run `bash native/prepare.sh` to fetch checksum-pinned QuickJS 2025-09-13,
Pixman 0.42.2 and Cairo 1.16.0 sources. Inside the Valve SDK container, run
`bash native/build.sh`. The SDK's SDL libraries and DejaVu Sans Mono are bundled
privately; system libraries are not overwritten. `native/package.py ROOTFS OUT`
creates the downloadable archive. Upstream dependency licenses are under
`LICENSES/` in the package. Cairo is distributed under its MPL 1.1 option.
Valve SDK sources, including its external library sources, are available at
https://github.com/ValveSoftware/steamlink-sdk .
