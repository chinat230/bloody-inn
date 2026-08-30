import { describe, expect, it } from 'vitest';
import { fillWelcome, isolatePoliceFee, mustFail, newGame } from './helpers';
import { applyMove, def } from '../src/engine';

describe('police investigation', () => {
  it('does not investigate when no police remain in open rooms', () => {
    let s = fillWelcome(newGame({ seed: 2 }));
    const cops = s.rooms.filter((r) => r.guest && def(r.guest).type === 'police');
    // Kill or leave them? If none, four passes should skip police phase.
    if (cops.length === 0) {
      for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
      expect(s.phase).not.toBe('police');
    }
  });

  it('triggers investigation if a police card is still in an open room', () => {
    let s = fillWelcome(newGame({ seed: 2 }));
    const copRoom = s.rooms.find((r) => r.guest && def(r.guest).type === 'police');
    if (!copRoom) {
      // Force a peacekeeper into an open room.
      const room = s.rooms.find((r) => r.keyColor && r.guest)!;
      room.guest = { uid: 'forced-cop', occupationId: 'peacekeeper' };
    }
    s.players[0].unburied.push({ uid: 'body', occupationId: 'baron' });
    for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
    expect(s.phase).toBe('police');
    expect(s.pendingPlayers).toContain(0);
  });

  it('rejects underpaying when the player can afford 10F per corpse', () => {
    let s = fillWelcome(newGame({ seed: 2 }));
    const room = s.rooms.find((r) => r.keyColor && r.guest)!;
    room.guest = { uid: 'forced-cop', occupationId: 'peacekeeper' };
    s.players[0].unburied.push({ uid: 'body', occupationId: 'baron' });
    s.players[0].cash = 15;
    s.players[0].checks = 1;
    for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
    expect(s.phase).toBe('police');
    expect(mustFail(s, { type: 'policePay', cash: 0, checks: 0 })).toMatch(/exactly/i);
  });

  it('boxes all unburied corpses and charges 10F each', () => {
    let s = isolatePoliceFee(fillWelcome(newGame({ seed: 2 })), 20);
    for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
    const paid = applyMove(s, { type: 'policePay', cash: 10, checks: 0 });
    expect(paid.players[0].unburied).toHaveLength(0);
    expect(paid.box.some((c) => c.uid === 'body')).toBe(true);
    expect(paid.players[0].cash).toBe(10);
  });

  it('still bins corpses if the player cannot pay in full', () => {
    let s = fillWelcome(newGame({ seed: 2 }));
    const room = s.rooms.find((r) => r.keyColor && r.guest)!;
    room.guest = { uid: 'forced-cop', occupationId: 'peacekeeper' };
    s.players[0].unburied.push({ uid: 'body', occupationId: 'baron' });
    s.players[0].cash = 3;
    s.players[0].checks = 0;
    for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
    const paid = applyMove(s, { type: 'policePay', cash: 3, checks: 0 });
    expect(paid.players[0].unburied).toHaveLength(0);
    expect(paid.players[0].cash).toBe(0);
  });
});
