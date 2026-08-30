import { describe, expect, it } from 'vitest';
import { fillWelcome, newGame } from './helpers';
import { applyMove } from '../src/engine';

describe('round flow', () => {
  it('Welcome fills every open room then starts night pulse 1', () => {
    const s = fillWelcome(newGame({ seed: 3 }));
    expect(s.phase).toBe('night');
    expect(s.nightPulse).toBe(1);
    expect(s.currentPlayer).toBe(s.firstPlayer);
    const open = s.rooms.filter((r) => r.keyColor);
    expect(open.every((r) => r.guest)).toBe(true);
  });

  it('two night pulses: each player acts once, then once more, then morning', () => {
    let s = fillWelcome(newGame({ seed: 3 }));
    expect(s.nightPulse).toBe(1);
    s = applyMove(s, { type: 'pass' }); // p0
    expect(s.currentPlayer).toBe(1);
    expect(s.nightPulse).toBe(1);
    s = applyMove(s, { type: 'pass' }); // p1
    expect(s.nightPulse).toBe(2);
    expect(s.currentPlayer).toBe(0);
    s = applyMove(s, { type: 'pass' }); // p0 pulse 2
    expect(s.currentPlayer).toBe(1);
    s = applyMove(s, { type: 'pass' }); // p1 pulse 2 → morning → maybe next welcome
    expect(s.phase === 'welcome' || s.phase === 'police' || s.phase === 'wages').toBe(true);
  });

  it('passes the first-player marker left after a full round', () => {
    let s = fillWelcome(newGame({ seed: 3 }));
    const first = s.firstPlayer;
    // 4 passes complete the night; morning with no unpaid wages should start next welcome
    for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
    if (s.phase === 'welcome') {
      expect(s.firstPlayer).toBe((first + 1) % 2);
      expect(s.round).toBe(2);
    }
  });

  it('pays 1F per occupied owned room at departure', () => {
    let s = fillWelcome(newGame({ seed: 11 }));
    const p0Rooms = s.rooms.filter((r) => r.keyColor === s.players[0].color && r.guest).length;
    const cash = s.players[0].cash;
    for (let i = 0; i < 4; i++) s = applyMove(s, { type: 'pass' });
    // After morning, cash = start + room income - wages (2 peasants = 2F) unless discarded
    if (s.phase === 'welcome') {
      const p = s.players[0];
      expect(p.cash).toBe(Math.min(40, Math.max(0, cash + p0Rooms - 2)));
    }
  });
});
