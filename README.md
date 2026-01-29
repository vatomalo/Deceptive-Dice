# Deceptive-Dice
A fast-paced cinematic dice-duel game inspired by Seiken Densetsu 3, Samurai Shodown, and FFVII’s materia system, built entirely in JavaScript/Canvas. Every round is a mind-game: roll, clash, attack, evade, or pass using ninja-style repositioning. Weather, lighting, and dynamic FX make each duel feel alive.


[Game link:](https://vatomalo.github.io/Deceptive-Dice/)


Core Features
🎲 Dice-Driven Combat System

A custom 3×2 dice sprite engine with:

Physics: bounce arcs, wobble scale, timed stop

Auto-centered pips so every face is perfectly aligned

Cinematic “reveal → clash → attack” flow

Smoke FX that hides dice during roll and bursts on resolution





🗡️ 2D Action Animations

Uses a flexible Character system with:

Per-state sprite sheets (idle / run / attack / hurt / death)

Tween-based movement for smooth SNES-style pacing

Blink-teleport & shadow-clone FX for PASS maneuvers

⚔️ JRPG Enemy System (Revamped in v1.1)

Dynamic enemy generation with:

Four knight tiers (Novice → Champion)

Independent Enemy Level scaling with evolving STR/AGI/DEF

Souls-like auto-titles (“Ashen Revenant”, “Pale Judge of the Void”)

Random materia enhancements (counter, thorns, poison)

💠 Materia System (v1.1 Major Feature)

A full FF-style materia engine with:

Counter chance

Thorns damage

Poison application & ticking

Speed (AGI boost)

Barrier (DEF boost)

Regen over time

Crit chance
All implemented cleanly in materiasystem.js with hooks into combat and damage engines .




🌀 Stamina System (Player + Enemy)

Light fighting-game stamina with:

Regeneration per frame

Low-stamina flicker

Costs tied to PASS / ATTACK / dodge logic




🎨 Full Visual Pipeline

Parallax backgrounds with static & scrolling layers

Foreground & background decor buffers (Neo-Geo style layering)

Dynamic weather FX (sakura petals, pixel-rain, blended densities)

Weather Director for mood-based transitions (clear → sakura → heavy rain)

Day/Night palette system with smooth transitions (dawn/day/dusk/night) and weather integration






🔥 Combat FX System

Smoke, sparks, slashes, dust trails, teleport rings, angel-spark FX

All particle-driven, frame-stable, fully layered above combatants

Managed by a global FXManager for spawning & lifetime control




📊 UI & HUD

Nameplates, level displays, stamina bars, stat panels

Full HP bar widget for player/enemy with dynamic max HP changes

X-Bar combat UI (ROLL / ATTACK / PASS) with input-lock safety




🎵 Adaptive BGM + Announcer

Automatic BGM shuffling by mood (calm/tense/story) with crossfades

Announcer voice (“FIGHT!”, “KO!”, “GAME OVER”) on key events





⚡ Gameloop (Final Integration)

A unified canvas render loop handling:

Character states & animation

Dice placement

FX, weather, parallax, palette

Damage text popups

Stamina regen

Flash effects

UI and HP bar rendering
All implemented in renderloop.js .

Version 1.1 Goals (Current Release)

✔ Enemy behavioral overhaul

✔ Materia expansion 

✔ Enemy stamina logic fixed

☐ Materia menu UI (in progress)

☐ Balancing pass for STR/AGI/DEF at higher waves

☐ Additional enemy types for late-game (Wraith, Phantom Knight, etc.)

Tech Stack

ES6 JavaScript

HTML5 Canvas

Zero external libraries

Fully custom animation, physics, FX, and combat engines

Project Vision

Deceptive Dice aims to be a micro-JRPG with the intensity of an arcade fighting game, where:

every roll feels like a duel,

every attack is cinematic,

and the world feels alive through weather, light, and momentum.
