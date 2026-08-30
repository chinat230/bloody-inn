import type { GameState, Move, PlayerState, Card } from './types';
import {
  applyMove,
  autoPolicePay,
  def,
  getActor,
  hasEffect,
  lootOf,
  paymentNeeded,
  remainingCapacity,
  tryMove,
} from './engine';
import { nextRng } from './rng';

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

function pickPayment(
  hand: Card[],
  k: number,
  affinity: 'bribe' | 'build' | 'kill' | 'bury' | null,
  exclude: Set<string> = new Set(),
): string[] | null {
  if (k === 0) return [];
  const pool = hand.filter((c) => !exclude.has(c.uid));
  if (pool.length < k) return null;
  const scored = pool.map((c) => {
    const d = def(c);
    let s = 0;
    if (affinity && d.affinity === affinity) s -= 50;
    if (d.type === 'peasant') s -= 10;
    s += d.rank * 4;
    if (d.annex) s += 6;
    return { c, s };
  });
  scored.sort((a, b) => a.s - b.s);
  return scored.slice(0, k).map((x) => x.c.uid);
}

function payFor(
  p: PlayerState,
  action: 'bribe' | 'build' | 'kill' | 'bury',
  rankSum: number,
  exclude: Set<string> = new Set(),
): string[] | null {
  const need = paymentNeeded(p, action, rankSum, true);
  return pickPayment(p.hand, need, action, exclude);
}

export function listLegalMoves(state: GameState): Move[] {
  const actor = getActor(state);
  if (!actor) return [];
  const moves: Move[] = [];

  if (state.phase === 'welcome' && state.pendingGuest) {
    for (const r of state.rooms) {
      if (r.keyColor && !r.guest) moves.push({ type: 'welcome', room: r.number });
    }
    return moves;
  }

  if (state.phase === 'police' || state.phase === 'endGrave') {
    const pay = autoPolicePay(actor);
    moves.push(
      state.phase === 'police'
        ? { type: 'policePay', ...pay }
        : { type: 'endGravePay', ...pay },
    );
    return moves;
  }

  if (state.phase === 'wages') {
    const k = actor.unpaid ?? 0;
    for (const combo of combinations(actor.hand, k)) {
      moves.push({ type: 'wageDiscard', cardUids: combo.map((c) => c.uid) });
    }
    return moves;
  }

  if (state.phase !== 'night') return moves;

  moves.push({ type: 'pass' });
  const maxChecksOut = Math.floor(actor.cash / 10);
  for (let n = 1; n <= maxChecksOut; n++) {
    moves.push({ type: 'pass', launder: { dir: 'toChecks', n } });
  }
  for (let n = 1; n <= actor.checks; n++) {
    moves.push({ type: 'pass', launder: { dir: 'toCash', n } });
  }

  const occupied = state.rooms.filter((r) => r.guest);
  const tryRoomSet = (rooms: number[]) => {
    const rankSum = rooms.reduce((s, n) => {
      const g = state.rooms.find((r) => r.number === n)!.guest!;
      return s + def(g).rank;
    }, 0);
    const pay = payFor(actor, 'bribe', rankSum);
    if (!pay) return;
    moves.push({ type: 'bribe', rooms, peasantUids: [], payment: pay });
  };
  for (const r of occupied) tryRoomSet([r.number]);
  if (hasEffect(actor, 'shop') && occupied.length > 1) {
    const ids = occupied.map((r) => r.number);
    if (ids.length <= 3) {
      for (let k = 2; k <= ids.length; k++) {
        for (const combo of combinations(ids, k)) tryRoomSet(combo);
      }
    }
  }

  if (state.bistro.length) {
    const max = Math.min(state.bistro.length, hasEffect(actor, 'brewery') ? 4 : 2);
    for (let k = 1; k <= max; k++) {
      moves.push({
        type: 'bribe',
        rooms: [],
        peasantUids: state.bistro.slice(0, k).map((c) => c.uid),
        payment: [],
      });
    }
  }

  for (const c of actor.hand) {
    const d = def(c);
    if (!d.annex) continue;
    const pay = payFor(actor, 'build', d.rank, new Set([c.uid]));
    if (!pay) continue;
    if (d.annex.id === 'roomService') {
      for (const r of state.rooms) {
        if (r.keyColor && r.roomServiceOwner == null) {
          moves.push({ type: 'build', cardUid: c.uid, payment: pay, roomServiceRoom: r.number });
        }
      }
    } else if (d.annex.id === 'bedroom') {
      const whites = state.rooms.filter((r) => r.keyColor === 'white');
      if (!whites.length) moves.push({ type: 'build', cardUid: c.uid, payment: pay });
      else {
        for (const r of whites) {
          moves.push({ type: 'build', cardUid: c.uid, payment: pay, monkRoom: r.number });
        }
      }
    } else {
      moves.push({ type: 'build', cardUid: c.uid, payment: pay });
    }
  }

  for (const r of occupied) {
    const pay = payFor(actor, 'kill', def(r.guest!).rank);
    if (!pay) continue;
    moves.push({ type: 'kill', rooms: [r.number], peasantUid: null, payment: pay });
  }
  if (hasEffect(actor, 'butcherShop') && occupied.length > 1) {
    const ids = occupied.map((r) => r.number);
    const rankSum = occupied.reduce((s, r) => s + def(r.guest!).rank, 0);
    const pay = payFor(actor, 'kill', rankSum);
    if (pay) moves.push({ type: 'kill', rooms: ids, peasantUid: null, payment: pay });
  }
  if (state.bistro.length) {
    moves.push({ type: 'kill', rooms: [], peasantUid: state.bistro[0].uid, payment: [] });
  }

  const annexes: { uid: string }[] = [];
  for (const pl of state.players) {
    for (const a of pl.annexes) {
      if (remainingCapacity(a) > 0) annexes.push(a);
    }
  }
  for (const corpse of actor.unburied) {
    const pay = payFor(actor, 'bury', def(corpse).rank);
    if (!pay) continue;
    for (const a of annexes) {
      moves.push({
        type: 'bury',
        corpses: [{ uid: corpse.uid, annexUid: a.uid }],
        payment: pay,
      });
    }
  }
  return moves;
}

function evaluate(state: GameState, me: number): number {
  const p = state.players[me];
  let v = lootOf(p) * 10;
  v += p.annexes.length * 8;
  v += p.unburied.reduce((s, c) => s + def(c).pocket, 0);
  const police = state.rooms.some((r) => r.guest && def(r.guest).type === 'police');
  if (police) v -= p.unburied.length * 40;
  else v -= p.unburied.length * 8;
  v += p.hand.reduce((s, c) => s + def(c).rank + (def(c).annex ? 3 : 0), 0);
  if (state.scores) {
    const row = state.scores.find((s) => s.playerId === me);
    if (row) v += row.loot * 20;
    if (state.winnerIds.includes(me)) v += 500;
  }
  return v;
}

export function chooseAiMove(state: GameState): Move {
  const actor = getActor(state);
  if (!actor) throw new Error('No actor');
  const moves = listLegalMoves(state);
  if (!moves.length) throw new Error('No legal moves');

  const tutorialPassive = state.config.tutorial && state.phase === 'night' && state.round <= 2;
  const scored: { move: Move; v: number }[] = [];
  for (const move of moves) {
    const r = tryMove(state, move);
    if (!r.ok) continue;
    let v = evaluate(r.state, actor.id);
    if (tutorialPassive) {
      if (move.type === 'pass' && !move.launder) v += 80;
      if (move.type === 'kill' || move.type === 'bribe') v -= 30;
    }
    if (state.config.aiDifficulty === 'easy' && move.type === 'pass' && !move.launder) v += 12;
    if (move.type === 'bury') {
      const own = actor.annexes.map((a) => a.uid);
      if (move.corpses.every((c) => own.includes(c.annexUid))) v += 25;
    }
    scored.push({ move, v });
  }
  if (!scored.length) return moves[0];
  scored.sort((a, b) => b.v - a.v);
  if (state.config.aiDifficulty === 'easy' || tutorialPassive) {
    const top = scored.slice(0, Math.min(3, scored.length));
    const rng = nextRng(state.rngState + state.round * 17 + state.currentPlayer);
    return top[Math.floor(rng.value * top.length)].move;
  }
  return scored[0].move;
}

export function applyAiTurn(state: GameState): GameState {
  return applyMove(state, chooseAiMove(state));
}


export function needsHuman(state: GameState): boolean {
  if (state.phase === 'gameOver') return false;
  const actor = getActor(state);
  return actor?.isHuman === true;
}

export function playUntilHuman(state: GameState, maxSteps = 60): GameState {
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === 'gameOver') return s;
    if (needsHuman(s)) return s;
    s = applyAiTurn(s);
  }
  return s;
}
