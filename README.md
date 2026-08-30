# The Bloody Inn — teaching table

A local-first browser app that teaches the base game of The Bloody Inn by playing it. Original 1830s-inn interface; no official card art, logos, or rulebook prose.

## How to run

Working directory: /workspace/bloody-inn

1. Install Node packages (package-lock present).
2. Run the test script (Vitest).
3. Run the dev script (Vite) and open http://localhost:5173

Exact scripts are named `test` and `dev` in package.json.

- Tutorial (first screen): short scripted table vs one easy computer. Coach copy walks Welcome, two Night pulses, Bribe / Build / Kill / Bury / Pass, police, wages, and scoring. Skippable.
- Play vs computers: official 2-4 player setup (1 human + 1-3 AIs), short or long, easy or normal greedy AI. AI only emits legal moves.

Keyboard: 1-5 or B N K Y P for night actions, 1-8 to seat a guest, Esc cancel, Enter confirm.

## Architecture

- src/engine/ — pure TypeScript rules (no DOM).
- src/ui/ — React table, coach, cards.
- tests/ — illegal-move coverage plus an AI playthrough.

See STATUS.md for rules assumptions (pockets, copies, police roster).
Unverified pockets used: rank 0=4F, 1=10F, 2=18F, 3=26F (2 and 3 match sampled 2017 EN card art).
