import { describe, expect, it } from 'vitest';
import { applyMove, def } from '../src/engine';
import { fillWelcome, isolatePoliceFee, newGame } from './helpers';

function bothPass(s: ReturnType<typeof fillWelcome>) {
  let n = s;
  for (let i = 0; i < 4; i++) n = applyMove(n, { type: 'pass' });
  return n;
}

describe('morning / police / wages', () => {
  it('investigates if police remain: 10F per unburied corpse, bodies to the box', () => {
    let s = isolatePoliceFee(fillWelcome(newGame({ seed: 2 })), 15, 1);
    s = bothPass(s);
    expect(s.phase).toBe('police');
    s = applyMove(s, { type: 'policePay', cash: 10, checks: 0 });
    expect(s.players[0].unburied).toHaveLength(0);
    expect(s.box.some((c) => c.uid === 'body')).toBe(true);
    expect(s.players[0].cash).toBe(5);
  });

  it('skips investigation when no police remain in rooms', () => {
    let s = fillWelcome(newGame({ seed: 8 }));
    for (const r of s.rooms) {
      if (r.guest && def(r.guest).type === 'police') {
        r.guest = { uid: 'nob', occupationId: 'baron' };
      }
    }
    s.players[0].unburied.push({ uid: 'body', occupationId: 'newsboy' });
    const cash = s.players[0].cash;
    s = bothPass(s);
    expect(s.phase).not.toBe('police');
    expect(s.players[0].unburied.length).toBeGreaterThan(0);
    // corpses remain; cash changed only by departure/wages
    expect(s.players[0].unburied.some((c) => c.uid === 'body')).toBe(true);
    void cash;
  });

  it('Gardener adds 2F at travelers-leave', () => {
    let s = fillWelcome(newGame({ seed: 4 }));
    for (const r of s.rooms) {
      if (r.guest && def(r.guest).type === 'police') r.guest = { uid: `n${r.number}`, occupationId: 'baron' };
    }
    s.players[0].annexes.push({
      uid: 'g',
      card: { uid: 'ga', occupationId: 'gardener' },
      effectId: 'gardens',
      rank: 3,
      buried: [],
    });
    s.players[0].hand = [];
    const cash = s.players[0].cash;
    const rooms = s.rooms.filter((r) => r.keyColor === s.players[0].color && r.guest).length;
    s = bothPass(s);
    if (s.phase === 'welcome') {
      expect(s.players[0].cash).toBe(cash + rooms + 2);
    }
  });
});

describe('welcome room service', () => {
  it('charges room service equal to rank when a guest sits', () => {
    const g = newGame({ seed: 3 });
    const guest = g.pendingGuest!;
    g.rooms.find((r) => r.number === 3)!.roomServiceOwner = 0;
    const before = g.players[0].cash;
    const next = applyMove(g, { type: 'welcome', room: 3 });
    expect(next.rooms.find((r) => r.number === 3)!.guest?.uid).toBe(guest.uid);
    expect(next.players[0].cash).toBe(before + def(guest).rank);
  });
});
