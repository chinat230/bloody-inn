import { describe, expect, it } from 'vitest';
import { applyMove, IllegalMoveError } from '../src/engine';
import { mustFail, nightGame } from './helpers';

describe('illegal moves are rejected', () => {
  it('rejects kill without enough payment', () => {
    const s = nightGame();
    const room = s.rooms.find((r) => r.guest)!;
    s.players[0].hand = [{ uid: 'only', occupationId: 'peasant' }];
    room.guest = { uid: 'duke1', occupationId: 'duke' }; // rank 3
    const msg = mustFail(s, {
      type: 'kill',
      rooms: [room.number],
      peasantUid: null,
      payment: ['only'],
    });
    expect(msg).toMatch(/Kill costs/i);
  });

  it('rejects burying an opponent corpse', () => {
    const s = nightGame();
    s.players[1].unburied.push({ uid: 'theirs', occupationId: 'baron' });
    const msg = mustFail(s, {
      type: 'bury',
      corpses: [{ uid: 'theirs', annexUid: s.players[0].annexes[0].uid }],
      payment: [],
    });
    expect(msg).toMatch(/own corpses/i);
  });

  it('rejects building police or peasants', () => {
    const s = nightGame();
    s.players[0].hand = [
      { uid: 'cop', occupationId: 'police' },
      { uid: 'pea', occupationId: 'peasant' },
    ];
    expect(mustFail(s, { type: 'build', cardUid: 'cop', payment: [] })).toMatch(/cannot be built/i);
    expect(mustFail(s, { type: 'build', cardUid: 'pea', payment: [] })).toMatch(/cannot be built/i);
  });

  it('rejects bury under a full barn or rank-0 annex', () => {
    const s = nightGame();
    s.players[0].annexes[0].buried.push({ uid: 'full', occupationId: 'baron' });
    s.players[0].unburied.push({ uid: 'body', occupationId: 'newsboy' });
    expect(
      mustFail(s, {
        type: 'bury',
        corpses: [{ uid: 'body', annexUid: s.players[0].annexes[0].uid }],
        payment: [],
      }),
    ).toMatch(/full|capacity/i);

    const s2 = nightGame();
    s2.players[0].annexes.push({
      uid: 'kiosk',
      card: { uid: 'nb', occupationId: 'newsboy' },
      effectId: 'kiosk',
      rank: 0,
      buried: [],
    });
    s2.players[0].unburied.push({ uid: 'body2', occupationId: 'brigadier' });
    s2.players[0].hand = [{ uid: 'p', occupationId: 'peasant' }];
    expect(
      mustFail(s2, {
        type: 'bury',
        corpses: [{ uid: 'body2', annexUid: 'kiosk' }],
        payment: ['p'],
      }),
    ).toMatch(/full|capacity/i);
  });

  it('rejects bribing multiple rooms without Shop', () => {
    const s = nightGame();
    const rooms = s.rooms.filter((r) => r.guest).slice(0, 2);
    expect(
      mustFail(s, {
        type: 'bribe',
        rooms: rooms.map((r) => r.number),
        peasantUids: [],
        payment: [],
      }),
    ).toMatch(/Shop/i);
  });

  it('rejects mixing room bribe and bistro peasants', () => {
    const s = nightGame();
    s.bistro.push({ uid: 'pea', occupationId: 'peasant' });
    const room = s.rooms.find((r) => r.guest)!;
    expect(
      mustFail(s, {
        type: 'bribe',
        rooms: [room.number],
        peasantUids: ['pea'],
        payment: [],
      }),
    ).toMatch(/not both/i);
  });

  it('rejects actions off-phase', () => {
    const s = nightGame();
    s.phase = 'welcome';
    expect(() => applyMove(s, { type: 'pass' })).toThrow(IllegalMoveError);
  });

  it('rejects laundering more cash than held', () => {
    const s = nightGame();
    s.players[0].cash = 5;
    expect(mustFail(s, { type: 'pass', launder: { dir: 'toChecks', n: 1 } })).toMatch(/Not enough cash/i);
  });
});
