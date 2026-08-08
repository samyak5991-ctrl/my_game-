# My Game — Prototype

This branch contains a minimal HTML5 + Three.js prototype for the open-world car game you requested.

What is included
- Vite + TypeScript scaffold
- Three.js rendering and cannon-es physics
- Simple drivable car (physics box) with collision-based damage
- Damage impacts reduce top speed and tint the car
- Get in / get out (simple on-foot spawn)
- Mod menu (fly, noclip) — singleplayer-only features
- Touch controls shown on mobile

Run locally
1. Install dependencies: npm install
2. Start dev server: npm run dev
3. Open the address printed by Vite (usually http://localhost:5173)

Notes & next steps
- This is an initial prototype focusing on phase 0 + parts of phase 1.
- Visuals are placeholder boxes. Next commits will add free glTF cars, improved vehicle physics, damage visuals (decals/normal blending), mission system, and mobile-quality fallbacks.
- Assets used will be free glTF models and HDRI maps; I will include credits when adding them.

License
All code in this repository is under your repository's license. Assets will be credited in future commits.
