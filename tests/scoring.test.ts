import { describe, expect, it } from 'vitest';
import { nightGame } from './helpers';
import { applyMove, def, lootOf } from '../src/engine';
import { createGame } from '../src/engine';

describe('money and scoring', () => {
  it('never grants cash on kill', () => {
    const s = nightGame();
    const room = s.rooms.find((r) => r.guest && def(r.guest).rank === 0);
    if (!room) return;
    const cash = s.players[0].cash;
    const next = applyMove(s, {
      type: 'kill',
      rooms: [room.number],
      peasantUid: null,
      payment: [],
    });
    expect(next.players[0].cash).toBe(cash);
  });

  it('hard-caps cash at 40F', () => {
    const s = nightGame();
    s.players[0].cash = 38;
    const room = s.rooms.find((r) => r.guest && def(r.guest).rank === 0);
    if (!room) return;
    const guest = room.guest!;
    s.currentPlayer = 0;
    const killed = applyMove(s, {
      type: 'kill',
      rooms: [room.number],
      peasantUid: null,
      payment: [],
    });
    killed.currentPlayer = 0;
    killed.phase = 'night';
    const buried = applyMove(killed, {
      type: 'bury',
      corpses: [{ uid: guest.uid, annexUid: killed.players[0].annexes[0].uid }],
      payment: [],
    });
    expect(buried.players[0].cash).toBeLessThanOrEqual(40);
  });

  it('loot is cash plus 10F per check', () => {
    const s = nightGame();
    s.players[0].cash = 17;
    s.players[0].checks = 3;
    expect(lootOf(s.players[0])).toBe(47);
  });

  it('tutorial deck has no peasants in the entrance', () => {
    const s = createGame({
      playerCount: 2,
      length: 'tutorial',
      aiDifficulty: 'easy',
      seed: 1,
      tutorial: true,
    });
    const pile = [...s.entrance, s.pendingGuest].filter(Boolean);
    expect(pile.every((c) => c && def(c).occupationId !== 'peasant')).toBe(true);
    expect(s.players[0].hand).toHaveLength(2);
  });

  it('launder converts exactly 10F per check in one direction', () => {
    const s = nightGame();
    s.players[0].cash = 25;
    s.players[0].checks = 1;
    const next = applyMove(s, { type: 'pass', launder: { dir: 'toChecks', n: 2 } });
    expect(next.players[0].cash).toBe(5);
    expect(next.players[0].checks).toBe(3);
  });
});
