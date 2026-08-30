import { describe, expect, it } from 'vitest';
import { chooseAiMove, createGame, tryMove } from '../src/engine';

describe('AI playthrough', () => {
  it('only proposes legal moves and can finish a tutorial game', () => {
    let s = createGame({
      playerCount: 2,
      length: 'tutorial',
      aiDifficulty: 'easy',
      seed: 99,
      tutorial: true,
    });
    let guard = 0;
    while (s.phase !== 'gameOver' && guard++ < 4000) {
      const move = chooseAiMove(s);
      const r = tryMove(s, move);
      expect(r.ok, r.ok ? '' : `Illegal AI move ${JSON.stringify(move)}: ${!r.ok ? r.error : ''}`).toBe(true);
      if (r.ok) s = r.state;
      else break;
    }
    expect(s.phase).toBe('gameOver');
    expect(s.scores).not.toBeNull();
    expect(s.winnerIds.length).toBeGreaterThan(0);
  });
});
