# Deceptive Dice for Steam Link hardware

Experimental native ARMv7 port of the original JavaScript/Canvas game. QuickJS
runs the existing combat and animation engine; Cairo/Pixman render Canvas and
SDL2 handles display, controllers, fonts and audio. No PC streaming is required.
The display buffer is 640×360, scaled to the television by SDL.

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

The ARM binary is built with Valve's Steam Link SDK. Desktop rendering and
combat smoke tests exercise the original assets and engine; ARM emulation
checks the target ABI. Physical-device graphics, controller mappings, audio and
frame rate still need testing. This preview does not add saved-game support.
Text stroke and font-family selection use the bundled DejaVu font. A small
pixel heart replaces an icon absent from the original repository.

## Build

Run `bash native/prepare.sh` to fetch checksum-pinned QuickJS 2025-09-13,
Pixman 0.42.2 and Cairo 1.16.0 sources. Inside the Valve SDK container, run
`bash native/build.sh`. The SDK's SDL libraries and DejaVu Sans Mono are bundled
privately; system libraries are not overwritten. `native/package.py ROOTFS OUT`
creates the downloadable archive. Upstream dependency licenses are under
`LICENSES/` in the package. Cairo is distributed under its MPL 1.1 option.
Valve SDK sources, including its external library sources, are available at
https://github.com/ValveSoftware/steamlink-sdk .
