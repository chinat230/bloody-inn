import { describe, expect, it } from 'vitest';
import { applyMove, def } from '../src/engine';
import { nightGame } from './helpers';

describe('actions', () => {
  it('does not pay money on kill', () => {
    const s = nightGame();
    const room = s.rooms.find((r) => r.guest)!;
    room.guest = { uid: 'forced-baron', occupationId: 'baron' };
    s.players[0].cash = 5;
    const next = applyMove(s, {
      type: 'kill',
      rooms: [room.number],
      peasantUid: null,
      payment: [],
    });
    expect(next.players[0].cash).toBe(5);
    expect(next.players[0].unburied).toHaveLength(1);
    expect(next.rooms.find((r) => r.number === room.number)!.guest).toBeNull();
  });

  it('pays pocket francs only on bury under your annex', () => {
    const s = nightGame();
    s.players[0].unburied = [{ uid: 'c', occupationId: 'count' }]; // rank 2, 18F
    s.players[0].cash = 5;
    s.players[0].hand = [
      { uid: 'a', occupationId: 'peasant' },
      { uid: 'b', occupationId: 'peasant' },
    ];
    const next = applyMove(s, {
      type: 'bury',
      corpses: [{ uid: 'c', annexUid: s.players[0].annexes[0].uid }],
      payment: ['a', 'b'],
    });
    expect(next.players[0].cash).toBe(23);
    expect(next.players[0].annexes[0].buried).toHaveLength(1);
    expect(next.players[0].unburied).toHaveLength(0);
  });

  it('splits bury payout in half under an opponent annex', () => {
    const s = nightGame();
    s.players[0].unburied = [{ uid: 'c', occupationId: 'count' }];
    s.players[0].cash = 10;
    s.players[1].cash = 10;
    s.players[0].hand = [
      { uid: 'a', occupationId: 'peasant' },
      { uid: 'b', occupationId: 'peasant' },
    ];
    const next = applyMove(s, {
      type: 'bury',
      corpses: [{ uid: 'c', annexUid: s.players[1].annexes[0].uid }],
      payment: ['a', 'b'],
    });
    expect(next.players[0].cash).toBe(19);
    expect(next.players[1].cash).toBe(19);
  });

  it('hard-caps cash at 40F', () => {
    const s = nightGame();
    s.players[0].unburied = [{ uid: 'm', occupationId: 'marquis' }]; // 26F
    s.players[0].cash = 30;
    s.players[0].hand = [
      { uid: 'a', occupationId: 'peasant' },
      { uid: 'b', occupationId: 'peasant' },
      { uid: 'c', occupationId: 'peacekeeper' },
    ];
    const next = applyMove(s, {
      type: 'bury',
      corpses: [{ uid: 'm', annexUid: s.players[0].annexes[0].uid }],
      payment: ['a', 'b', 'c'],
    });
    expect(next.players[0].cash).toBe(40);
  });

  it('refunds kill-affinity police and sends peasants to the bistro', () => {
    const s = nightGame();
    const room = s.rooms.find((r) => r.guest)!;
    room.guest = { uid: 'mech', occupationId: 'mechanic' };
    s.players[0].hand = [{ uid: 'cop', occupationId: 'brigadier' }];
    const next = applyMove(s, {
      type: 'kill',
      rooms: [room.number],
      peasantUid: null,
      payment: ['cop'],
    });
    expect(next.players[0].hand.some((c) => c.uid === 'cop')).toBe(true);

    const s2 = nightGame();
    const room2 = s2.rooms.find((r) => r.guest)!;
    room2.guest = { uid: 'mech2', occupationId: 'mechanic' };
    s2.players[0].hand = [{ uid: 'pea', occupationId: 'peasant' }];
    const n2 = applyMove(s2, {
      type: 'kill',
      rooms: [room2.number],
      peasantUid: null,
      payment: ['pea'],
    });
    expect(n2.bistro.some((c) => c.uid === 'pea')).toBe(true);
    expect(n2.exit.some((c) => c.uid === 'pea')).toBe(false);
  });

  it('bribes a rank-0 guest for free into hand', () => {
    const s = nightGame();
    const room = s.rooms.find((r) => r.guest)!;
    room.guest = { uid: 'bar', occupationId: 'baron' };
    const next = applyMove(s, {
      type: 'bribe',
      rooms: [room.number],
      peasantUids: [],
      payment: [],
    });
    expect(next.players[0].hand.some((c) => c.occupationId === 'baron')).toBe(true);
  });

  it('pass launders in one direction only', () => {
    const s = nightGame();
    s.players[0].cash = 25;
    s.players[0].checks = 1;
    const next = applyMove(s, { type: 'pass', launder: { dir: 'toChecks', n: 2 } });
    expect(next.players[0].cash).toBe(5);
    expect(next.players[0].checks).toBe(3);
  });

  it('builds an annex from hand paying rank in other cards', () => {
    const s = nightGame();
    s.players[0].hand = [
      { uid: 'v', occupationId: 'viscount' },
      { uid: 'p', occupationId: 'peasant' },
    ];
    const next = applyMove(s, { type: 'build', cardUid: 'v', payment: ['p'] });
    expect(next.players[0].annexes.some((a) => a.effectId === 'kingSizeBed')).toBe(true);
    expect(next.players[0].cash).toBe(s.players[0].cash + 6);
  });
});
