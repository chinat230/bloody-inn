import { useState } from 'react';
import { createGame, type GameConfig } from './engine';
import { GameView } from './ui/GameView';

type Screen = 'landing' | 'setup' | 'play';

export function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [length, setLength] = useState<'short' | 'long'>('short');
  const [diff, setDiff] = useState<'easy' | 'normal'>('easy');
  const [ais, setAis] = useState<1 | 2 | 3>(1);
  const [seed] = useState(() => (Date.now() ^ 1831) >>> 0);
  const [game, setGame] = useState(() => null as ReturnType<typeof createGame> | null);

  function start(cfg: Partial<GameConfig>) {
    setGame(createGame({ seed, humanIndex: 0, ...cfg }));
    setScreen('play');
  }

  if (screen === 'play' && game) {
    return (
      <div className="app-shell">
        <GameView
          initial={game}
          onExit={() => {
            setGame(null);
            setScreen('landing');
          }}
        />
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <div className="landing">
        <div className="landing-card">
          <div className="kicker">Versus the house</div>
          <h1>Play vs computers</h1>
          <p className="sub">Official 2–4 player base game. You seat as first player; rivals are greedy heuristics that only play legal moves.</p>
          <div className="setup-grid">
            <div className="field">
              <label>Length</label>
              <div className="seg">
                <button className={`btn small${length === 'short' ? ' active' : ''}`} onClick={() => setLength('short')}>
                  Short
                </button>
                <button className={`btn small${length === 'long' ? ' active' : ''}`} onClick={() => setLength('long')}>
                  Long
                </button>
              </div>
            </div>
            <div className="field">
              <label>AI</label>
              <div className="seg">
                <button className={`btn small${diff === 'easy' ? ' active' : ''}`} onClick={() => setDiff('easy')}>
                  Easy
                </button>
                <button className={`btn small${diff === 'normal' ? ' active' : ''}`} onClick={() => setDiff('normal')}>
                  Normal
                </button>
              </div>
            </div>
            <div className="field">
              <label>Opponents</label>
              <div className="seg">
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} className={`btn small${ais === n ? ' active' : ''}`} onClick={() => setAis(n)}>
                    {n} AI
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="row">
            <button
              className="btn primary"
              onClick={() =>
                start({
                  playerCount: (ais + 1) as 2 | 3 | 4,
                  length,
                  aiDifficulty: diff,
                  tutorial: false,
                })
              }
            >
              Open the inn
            </button>
            <button className="btn" onClick={() => setScreen('landing')}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="kicker">A teaching table</div>
        <h1>The Bloody Inn</h1>
        <p className="sub">
          Two seasons in a remote Ardèche inn. Bribe, build, kill, bury — pocket francs only when the body is under an
          annex. Original table, not official art.
        </p>
        <div className="row">
          <button
            className="btn primary"
            onClick={() =>
              start({
                playerCount: 2,
                length: 'short',
                aiDifficulty: 'easy',
                tutorial: true,
              })
            }
          >
            Begin tutorial
          </button>
          <button className="btn" onClick={() => setScreen('setup')}>
            Skip — play vs computer
          </button>
        </div>
        <p className="footer-note">
          Default: short 2-player game, you plus one easy rival. Coaching notes highlight legal rooms and cards. Skip
          anytime.
        </p>
      </div>
    </div>
  );
}
