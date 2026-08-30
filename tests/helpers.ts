import { applyMove, createGame, type GameConfig, type GameState, type Move } from '../src/engine';

export const defaultConfig: GameConfig = {
  playerCount: 2,
  length: 'short',
  aiDifficulty: 'easy',
  seed: 42,
  tutorial: false,
};

export function newGame(partial: Partial<GameConfig> = {}): GameState {
  return createGame({ ...defaultConfig, ...partial });
}

export function fillWelcome(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === 'welcome' && s.pendingGuest && guard++ < 20) {
    const room = s.rooms.find((r) => r.keyColor && !r.guest);
    if (!room) break;
    s = applyMove(s, { type: 'welcome', room: room.number });
  }
  return s;
}

export function nightGame(): GameState {
  return fillWelcome(newGame());
}

export function mustFail(state: GameState, move: Move): string {
  try {
    applyMove(state, move);
    throw new Error('Expected illegal move to throw');
  } catch (e) {
    if (e instanceof Error && e.message === 'Expected illegal move to throw') throw e;
    return e instanceof Error ? e.message : String(e);
  }
}

/** Isolate the 10F police corpse fee from departure income and wages. */
export function isolatePoliceFee(state: GameState, cash: number, checks = 1): GameState {
  const p0 = state.players[0];
  for (const r of state.rooms) {
    if (r.keyColor === p0.color) r.guest = null;
  }
  const room = state.rooms.find((r) => r.keyColor && r.keyColor !== p0.color);
  if (!room) throw new Error("Need an open room that is not player 0's");
  room.guest = { uid: 'forced-cop', occupationId: 'peacekeeper' };
  p0.unburied.push({ uid: 'body', occupationId: 'baron' });
  p0.hand = [];
  p0.cash = cash;
  p0.checks = checks;
  return state;
}
