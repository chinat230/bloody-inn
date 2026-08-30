import { describe, expect, it } from 'vitest';
import { CULL, createGame, def } from '../src/engine';

describe('setup', () => {
  it('does not shuffle peasants into the entrance', () => {
    const g = createGame({ seed: 7, playerCount: 2, length: 'short' });
    expect(g.entrance.every((c) => def(c).type !== 'peasant')).toBe(true);
    expect(g.bistro).toHaveLength(0);
    for (const r of g.rooms) {
      if (r.guest) expect(def(r.guest).type).not.toBe('peasant');
    }
  });

  it('culls unseen travelers by player count and length', () => {
    for (const n of [2, 3, 4] as const) {
      for (const length of ['short', 'long'] as const) {
        const g = createGame({ seed: 11, playerCount: n, length });
        const remaining = 70 - CULL[n][length];
        const inPlay = [
          ...g.entrance,
          ...(g.pendingGuest ? [g.pendingGuest] : []),
          ...g.rooms.flatMap((r) => (r.guest ? [r.guest] : [])),
        ].filter((c) => def(c).type !== 'peasant');
        const boxedTravelers = g.box.filter((c) => def(c).type !== 'peasant');
        expect(inPlay.length + boxedTravelers.length).toBe(70);
        expect(boxedTravelers.length).toBe(CULL[n][length]);
        expect(inPlay.length).toBe(remaining);
      }
    }
  });

  it('starts each player with 2 peasants, barn, 5F and one 10F check', () => {
    const g = createGame({ seed: 1, playerCount: 2, length: 'short' });
    for (const p of g.players) {
      expect(p.hand).toHaveLength(2);
      expect(p.hand.every((c) => c.occupationId === 'peasant')).toBe(true);
      expect(p.annexes).toHaveLength(1);
      expect(p.annexes[0].effectId).toBe('barn');
      expect(p.annexes[0].rank).toBe(1);
      expect(p.cash).toBe(5);
      expect(p.checks).toBe(1);
    }
  });

  it('opens 5 rooms in a 2-player game (1 key each + 3 white)', () => {
    const g = createGame({ seed: 1, playerCount: 2 });
    const open = g.rooms.filter((r) => r.keyColor);
    expect(open).toHaveLength(5);
    expect(open.filter((r) => r.keyColor === 'white')).toHaveLength(3);
    expect(g.pendingGuest).not.toBeNull();
    expect(g.phase).toBe('welcome');
  });

  it('builds 14 of each traveler type', () => {
    const g = createGame({ seed: 99, playerCount: 4, length: 'long' });
    const all = [
      ...g.entrance,
      ...(g.pendingGuest ? [g.pendingGuest] : []),
      ...g.box.filter((c) => def(c).type !== 'peasant'),
    ];
    expect(all).toHaveLength(70);
    for (const t of ['merchant', 'artisan', 'police', 'religious', 'noble'] as const) {
      expect(all.filter((c) => def(c).type === t)).toHaveLength(14);
    }
  });
});
