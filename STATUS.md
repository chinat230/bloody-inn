# Status

Unit tests and production build are green as of 2026-08-29 PT: clone is exported from src/engine/engine.ts; AI tests use the public API (playUntilHuman, listLegalMoves, chooseAiMove, tryMove); morning/police fixtures isolate the official 10F-per-unburied-corpse fee from traveler-leave income and wages (the engine was not overcharging); App types opponent count as two to four players. Tests (52) and the production build both succeed.

## How to run

Directory: /workspace/bloody-inn

Scripts in package.json:
- test — Vitest (52 tests, node).
- dev — Vite + React at http://localhost:5173
- install dependencies first if node_modules is missing.

Tutorial is the default first screen (skippable). Play vs 1-3 computers from the menu.

## Implemented

- Pure rules engine in src/engine, React UI in src/ui.
- Setup: 2 peasants each, barn rank-1, 5F + one 10F check, keys + white keys, empty multiplayer bistro. Peasants never enter the entrance. Unseen cull by player count and short/long (16-card scripted tutorial pile).
- Two seasons, public entrance top, searchable exit, two Night pulses, morning police / leave / wages.
- Bribe, Build, Kill, Bury, Pass/launder. Affinities, 40F cap, money on bury only.
- Annex table from the spec (Workshop, Parlor, Cellar, Shop, Butcher, Crypt, Priest, Concierge, Monk, Gardener, Distillery, Brewer, rank-3 color scoring, Prince greenhouse).
- Police investigation and end-game gravedigger.
- Easy/normal greedy AI that only plays legal moves. Tutorial vs 1 easy AI is completable; a full short game vs 1 computer can be played.
- Keyboard: 1-5 / B N K Y P, rooms 1-8, Esc, Enter. Dark 1830s inn, desktop-first, original UI.

## Rules assumptions

Unverified in the 2017 EN book (spec section 10):
1. Pockets: rank 2=18F and rank 3=26F verified. Rank 0=4F, rank 1=10F assumed. Peasants use rank-0 pocket.
2. Occupation copies: 14 per type, split 3/3/2/2/2/2 for ranks 0, 1, 2, and three rank-3 jobs.
3. Police (14): Peacekeeper x4 rank 0, Brigadier x4 rank 1, Chief Brigadier x3 rank 2, generic Police x3 rank 3.
4. Bury share is half each. Wages leftovers are player-chosen. Pass launders one direction.

Out of scope: solo printed variant, Unlimited Wealth, First Come First Served, Carnies.
