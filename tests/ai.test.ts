import { describe, expect, it } from 'vitest';
import {
  applyMove,
  chooseAiMove,
  createGame,
  listLegalMoves,
  playUntilHuman,
  tryMove,
} from '../src/engine';

describe('AI', () => {
  it('only proposes legal moves', () => {
    let s = createGame({ seed: 1831, playerCount: 2, length: 'short', aiDifficulty: 'easy' });
    s = playUntilHuman(s, 30);
    const move = chooseAiMove(s);
    expect(tryMove(s, move).ok).toBe(true);
  });

  it('can play a short 2-player game to completion with two AIs', () => {
    let s = createGame({ seed: 99, playerCount: 2, length: 'short', aiDifficulty: 'easy' });
    for (const p of s.players) p.isHuman = false;
    for (let i = 0; i < 500; i++) {
      if (s.phase === 'gameOver') break;
      const moves = listLegalMoves(s);
      expect(moves.length).toBeGreaterThan(0);
      const move = chooseAiMove(s);
      s = applyMove(s, move);
    }
    expect(s.phase).toBe('gameOver');
    expect(s.scores).toBeTruthy();
    expect(s.winnerIds.length).toBeGreaterThan(0);
  });
});
