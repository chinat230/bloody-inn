import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/engine';
import { mustFail, nightGame } from './helpers';

describe('annex occupations', () => {
  it('Cultivator pays 1F per red annex including itself', () => {
    const s = nightGame();
    const cash = s.players[0].cash;
    s.players[0].annexes.push({
      uid: 'w',
      card: { uid: 'm', occupationId: 'mechanic' },
      effectId: 'workshop',
      rank: 1,
      buried: [],
    });
    s.players[0].hand = [{ uid: 'c', occupationId: 'cultivator' }];
    const next = applyMove(s, { type: 'build', cardUid: 'c', payment: [] });
    expect(next.players[0].cash).toBe(cash + 2);
  });

  it('Workshop discount makes a rank-1 build free', () => {
    const s = nightGame();
    s.players[0].annexes.push({
      uid: 'w',
      card: { uid: 'm', occupationId: 'mechanic' },
      effectId: 'workshop',
      rank: 1,
      buried: [],
    });
    s.players[0].hand = [{ uid: 'v', occupationId: 'viscount' }];
    const next = applyMove(s, { type: 'build', cardUid: 'v', payment: [] });
    expect(next.players[0].annexes.some((a) => a.effectId === 'kingSizeBed')).toBe(true);
  });

  it('Shop lets you bribe two room travelers paying the sum of ranks', () => {
    const s = nightGame();
    s.players[0].annexes.push({
      uid: 's',
      card: { uid: 'sk', occupationId: 'shopkeeper' },
      effectId: 'shop',
      rank: 3,
      buried: [],
    });
    const r1 = s.rooms.find((r) => r.guest)!;
    const r2 = s.rooms.filter((r) => r.guest && r.number !== r1.number)[0];
    r1.guest = { uid: 'b', occupationId: 'baron' };
    r2.guest = { uid: 'n', occupationId: 'newsboy' };
    const next = applyMove(s, {
      type: 'bribe',
      rooms: [r1.number, r2.number],
      peasantUids: [],
      payment: [],
    });
    expect(next.players[0].hand.filter((c) => c.occupationId === 'baron' || c.occupationId === 'newsboy')).toHaveLength(2);
  });

  it('Shop does not apply to peasants (cannot mix)', () => {
    const s = nightGame();
    s.players[0].annexes.push({
      uid: 's',
      card: { uid: 'sk', occupationId: 'shopkeeper' },
      effectId: 'shop',
      rank: 3,
      buried: [],
    });
    s.bistro.push({ uid: 'pea', occupationId: 'peasant' });
    const r = s.rooms.find((r) => r.guest)!;
    expect(
      mustFail(s, {
        type: 'bribe',
        rooms: [r.number],
        peasantUids: ['pea'],
        payment: [],
      }),
    ).toMatch(/not both/i);
  });

  it('Butcher kills multiple room travelers; not peasants', () => {
    const s = nightGame();
    s.players[0].annexes.push({
      uid: 'b',
      card: { uid: 'bu', occupationId: 'butcher' },
      effectId: 'butcherShop',
      rank: 3,
      buried: [],
    });
    const rooms = s.rooms.filter((r) => r.guest).slice(0, 2);
    rooms[0].guest = { uid: 'b0', occupationId: 'baron' };
    rooms[1].guest = { uid: 'n0', occupationId: 'newsboy' };
    const cash = s.players[0].cash;
    const next = applyMove(s, {
      type: 'kill',
      rooms: rooms.map((r) => r.number),
      peasantUid: null,
      payment: [],
    });
    expect(next.players[0].unburied).toHaveLength(2);
    expect(next.players[0].cash).toBe(cash);
  });

  it('Monk replaces a white key', () => {
    const s = nightGame();
    s.players[0].hand = [
      { uid: 'mo', occupationId: 'monk' },
      { uid: 'p', occupationId: 'peasant' },
    ];
    const white = s.rooms.find((r) => r.keyColor === 'white')!;
    const next = applyMove(s, { type: 'build', cardUid: 'mo', payment: ['p'], monkRoom: white.number });
    expect(next.rooms.find((r) => r.number === white.number)!.keyColor).toBe(s.players[0].color);
  });

  it('Concierge places room service', () => {
    const s = nightGame();
    s.players[0].hand = [
      { uid: 'co', occupationId: 'concierge' },
      { uid: 'p1', occupationId: 'peasant' },
      { uid: 'p2', occupationId: 'peasant' },
    ];
    const next = applyMove(s, {
      type: 'build',
      cardUid: 'co',
      payment: ['p1', 'p2'],
      roomServiceRoom: 1,
    });
    expect(next.rooms.find((r) => r.number === 1)!.roomServiceOwner).toBe(0);
  });

  it('Priest returns non-affinity bury payment to hand', () => {
    const s = nightGame();
    s.players[0].annexes.push({
      uid: 'ch',
      card: { uid: 'pr', occupationId: 'priest' },
      effectId: 'chapel',
      rank: 3,
      buried: [],
    });
    s.players[0].unburied.push({ uid: 'body', occupationId: 'viscount' });
    s.players[0].hand = [{ uid: 'pea', occupationId: 'peasant' }];
    const next = applyMove(s, {
      type: 'bury',
      corpses: [{ uid: 'body', annexUid: s.players[0].annexes[0].uid }],
      payment: ['pea'],
    });
    expect(next.players[0].hand.some((c) => c.uid === 'pea')).toBe(true);
    expect(next.bistro.some((c) => c.uid === 'pea')).toBe(false);
  });

  it('Crypt buries multiple corpses paying the sum of ranks', () => {
    const s = nightGame();
    s.players[0].annexes.push({
      uid: 'cr',
      card: { uid: 'ar', occupationId: 'archbishop' },
      effectId: 'crypt',
      rank: 3,
      buried: [],
    });
    s.players[0].unburied.push({ uid: 'a', occupationId: 'baron' }, { uid: 'b', occupationId: 'newsboy' });
    const cash = s.players[0].cash;
    const next = applyMove(s, {
      type: 'bury',
      corpses: [
        { uid: 'a', annexUid: s.players[0].annexes[0].uid },
        { uid: 'b', annexUid: 'cr' },
      ],
      payment: [],
    });
    expect(next.players[0].unburied).toHaveLength(0);
    expect(next.players[0].cash).toBe(cash + 8);
  });

  it('Marquis immediately pays 18F', () => {
    const s = nightGame();
    const cash = s.players[0].cash;
    s.players[0].hand = [
      { uid: 'm', occupationId: 'marquis' },
      { uid: 'a', occupationId: 'peasant' },
      { uid: 'b', occupationId: 'peasant' },
      { uid: 'c', occupationId: 'peacekeeper' },
    ];
    const next = applyMove(s, { type: 'build', cardUid: 'm', payment: ['a', 'b', 'c'] });
    expect(next.players[0].cash).toBe(Math.min(40, cash + 18));
  });
});
