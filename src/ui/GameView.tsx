import { useEffect, useMemo, useState } from 'react';
import {
  applyMove,
  def,
  getActor,
  hasEffect,
  IllegalMoveError,
  listLegalMoves,
  needsHuman,
  paymentNeeded,
  playUntilHuman,
  remainingCapacity,
  autoPolicePay,
  type GameState,
  type Move,
} from '../engine';
import { Coach, noteForAction, type LessonId } from './Coach';
import { GuestCard } from './CardView';

type Draft = {
  action: 'bribe' | 'build' | 'kill' | 'bury' | 'pass' | null;
  rooms: number[];
  peasantUids: string[];
  cardUid: string | null;
  corpseUids: string[];
  annexUid: string | null;
  payment: string[];
  extraRoom: number | null;
  launderDir: 'toChecks' | 'toCash' | null;
  launderN: number;
};

const empty = (): Draft => ({
  action: null,
  rooms: [],
  peasantUids: [],
  cardUid: null,
  corpseUids: [],
  annexUid: null,
  payment: [],
  extraRoom: null,
  launderDir: null,
  launderN: 1,
});

export function GameView(props: { initial: GameState; onExit: () => void }) {
  const [state, setState] = useState(props.initial);
  const [draft, setDraft] = useState<Draft>(empty());
  const [err, setErr] = useState('');
  const [showExit, setShowExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lessons, setLessons] = useState<Set<LessonId>>(new Set());

  useEffect(() => {
    if (state.phase === 'gameOver' || needsHuman(state)) return;
    setBusy(true);
    const t = window.setTimeout(() => {
      try {
        setState(playUntilHuman(state));
      } finally {
        setBusy(false);
      }
    }, 420);
    return () => window.clearTimeout(t);
  }, [state]);

  useEffect(() => {
    setLessons((prev) => {
      const next = new Set(prev);
      if (state.phase === 'welcome') next.add('welcome');
      if (state.phase === 'night') next.add('night');
      if (state.phase === 'police') next.add('police');
      if (state.phase === 'wages') next.add('wages');
      if (state.phase === 'gameOver') next.add('score');
      return next;
    });
  }, [state.phase]);


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") setDraft(empty());
      if (state.phase === "welcome" && needsHuman(state) && /^[1-8]$/.test(e.key)) {
        commit({ type: "welcome", room: Number(e.key) });
      }
      if (state.phase === "night" && actor.isHuman && !draft.action) {
        const map: Record<string, Draft["action"]> = { b: "bribe", "1": "bribe", n: "build", "2": "build", k: "kill", "3": "kill", y: "bury", "4": "bury", p: "pass", "5": "pass" };
        const a = map[e.key.toLowerCase()];
        if (a) setDraft({ ...empty(), action: a });
      }
      if (e.key === "Enter") confirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const actor = getActor(state) ?? state.players[0];
  const legal = useMemo(() => listLegalMoves(state), [state]);
  const welcomeRooms = new Set(legal.filter((m) => m.type === 'welcome').map((m) => m.room));

  function commit(move: Move) {
    try {
      const next = applyMove(state, move);
      setState(next);
      setDraft(empty());
      setErr('');
      if (move.type === 'bribe' || move.type === 'build' || move.type === 'kill' || move.type === 'bury' || move.type === 'pass') {
        setLessons((p) => new Set(p).add(move.type));
      }
    } catch (e) {
      setErr(e instanceof IllegalMoveError ? e.message : String(e));
    }
  }

  function onRoom(n: number) {
    if (state.phase === 'welcome' && needsHuman(state)) {
      commit({ type: 'welcome', room: n });
      return;
    }
    if (state.phase !== 'night' || !actor.isHuman) return;
    if (draft.action === 'bribe' || draft.action === 'kill') {
      setDraft((d) => {
        const multi =
          (d.action === 'bribe' && hasEffect(actor, 'shop')) ||
          (d.action === 'kill' && hasEffect(actor, 'butcherShop'));
        const has = d.rooms.includes(n);
        const rooms = has ? d.rooms.filter((x) => x !== n) : multi ? [...d.rooms, n] : [n];
        return { ...d, rooms, peasantUids: [] };
      });
      return;
    }
    if (draft.action === 'build' && draft.cardUid) {
      setDraft((d) => ({ ...d, extraRoom: n }));
    }
  }

  function onHand(uid: string) {
    if (state.phase === 'wages' && actor.isHuman) {
      setDraft((d) => {
        const has = d.payment.includes(uid);
        return { ...d, payment: has ? d.payment.filter((x) => x !== uid) : [...d.payment, uid] };
      });
      return;
    }
    if (state.phase !== 'night' || !actor.isHuman || !draft.action) return;
    if (draft.action === 'build' && !draft.cardUid) {
      const c = actor.hand.find((x) => x.uid === uid);
      if (c && def(c).annex) {
        setDraft((d) => ({ ...d, cardUid: uid }));
        return;
      }
    }
    setDraft((d) => {
      if (uid === d.cardUid) return d;
      const has = d.payment.includes(uid);
      return { ...d, payment: has ? d.payment.filter((x) => x !== uid) : [...d.payment, uid] };
    });
  }

  function confirm() {
    if (state.phase === 'wages') {
      commit({ type: 'wageDiscard', cardUids: draft.payment });
      return;
    }
    if (state.phase === 'police') {
      const pay = autoPolicePay(actor);
      commit({ type: 'policePay', ...pay });
      return;
    }
    if (state.phase === 'endGrave') {
      const pay = autoPolicePay(actor);
      commit({ type: 'endGravePay', ...pay });
      return;
    }
    const m = toMove(state, draft);
    if (typeof m === 'string') {
      setErr(m);
      return;
    }
    commit(m);
  }

  return (
    <div className="game">
      <header className="topbar">
        <div>
          <span className="kicker">Peyrebeille · 1831</span>
          <h2>
            Season {state.season} · Round {state.round} · {label(state)}
          </h2>
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setShowExit(true)}>
            Exit stack ({state.exit.length})
          </button>
          <button className="btn small" onClick={props.onExit}>
            Leave table
          </button>
        </div>
      </header>
      {state.config.tutorial ? (
        <Coach state={state} done={lessons} />
      ) : (
        <div className="coach">{hint(state)}</div>
      )}

      <aside className="side">
        {state.players.map((p) => (
          <div className="player-block" key={p.id}>
            <h3>
              <span className={`key-dot key-${p.color}`} /> {p.name}
              {p.id === state.firstPlayer ? ' · First' : ''}
              {!p.isHuman ? ' · AI' : ''}
            </h3>
            <div className="tiny">
              {p.cash}F cash · {p.checks} checks · hand {p.hand.length} · corpses {p.unburied.length}
            </div>
            <div className="tiny" style={{ marginTop: 6 }}>
              Annexes (click when burying):
            </div>
            {p.annexes.map((a) => (
              <div
                key={a.uid}
                className="tiny"
                style={{
                  padding: '4px 0',
                  cursor: draft.action === 'bury' ? 'pointer' : 'default',
                  color: draft.annexUid === a.uid ? 'var(--blood-2)' : undefined,
                }}
                onClick={() => {
                  if (draft.action !== 'bury') return;
                  if (remainingCapacity(a) <= 0) return;
                  setDraft((d) => ({ ...d, annexUid: a.uid }));
                }}
              >
                {a.effectId === 'barn' ? 'Barn' : a.card ? def(a.card).annex?.name : a.effectId} · spare {remainingCapacity(a)}
                {a.buried.length ? ` · buried ${a.buried.length}` : ''}
              </div>
            ))}
            {p.unburied.length > 0 && (
              <div className="bistro-row">
                {p.unburied.map((c) => (
                  <GuestCard
                    key={c.uid}
                    card={c}
                    dead
                    compact
                    selected={draft.corpseUids.includes(c.uid)}
                    legal={draft.action === 'bury' && p.id === actor.id}
                    onClick={() => {
                      if (draft.action !== 'bury' || p.id !== actor.id) return;
                      setDraft((d) => {
                        const has = d.corpseUids.includes(c.uid);
                        const multi = hasEffect(actor, 'crypt');
                        const corpseUids = has
                          ? d.corpseUids.filter((x) => x !== c.uid)
                          : multi
                            ? [...d.corpseUids, c.uid]
                            : [c.uid];
                        return { ...d, corpseUids };
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        <h3>Log</h3>
        <div className="log">
          {[...state.log].reverse().map((e, i) => (
            <div key={i} className={tone(e.kind)}>
              {e.text}
            </div>
          ))}
        </div>
      </aside>

      <div className="board-wrap">
        <div className="inn-row">
          <div className="stack-pile">
            <h3>Entrance · {state.entrance.length}</h3>
            {state.pendingGuest ? (
              <GuestCard card={state.pendingGuest} />
            ) : state.entrance[0] ? (
              <GuestCard card={state.entrance[0]} />
            ) : (
              <div className="tiny">Empty</div>
            )}
            <div className="tiny" style={{ marginTop: 8 }}>
              Top is public. Countable, not searchable.
            </div>
          </div>
          <div>
            <div className="rooms">
              {state.rooms.slice(0, 4).map((r) => (
                <RoomCell
                  key={r.number}
                  room={r}
                  legal={welcomeRooms.has(r.number) || ((draft.action === 'bribe' || draft.action === 'kill') && !!r.guest) || (draft.action === 'build' && !!draft.cardUid)}
                  selected={draft.rooms.includes(r.number) || draft.extraRoom === r.number}
                  onClick={() => onRoom(r.number)}
                />
              ))}
            </div>
          </div>
          <div className="stack-pile">
            <h3>Exit · {state.exit.length}</h3>
            <div className="tiny">Searchable anytime.</div>
            <button className="btn small" style={{ marginTop: 8 }} onClick={() => setShowExit(true)}>
              Browse
            </button>
          </div>
        </div>
        <div className="inn-row">
          <div className="stack-pile">
            <h3>Bistro · {state.bistro.length}</h3>
            <div className="bistro-row">
              {state.bistro.map((c) => (
                <GuestCard
                  key={c.uid}
                  card={c}
                  compact
                  selected={draft.peasantUids.includes(c.uid)}
                  legal={draft.action === 'bribe' || draft.action === 'kill'}
                  onClick={() => {
                    if (draft.action === 'bribe') {
                      setDraft((d) => {
                        const has = d.peasantUids.includes(c.uid);
                        const max = hasEffect(actor, 'brewery') ? 4 : 2;
                        let peasantUids = has ? d.peasantUids.filter((x) => x !== c.uid) : [...d.peasantUids, c.uid];
                        if (peasantUids.length > max) peasantUids = peasantUids.slice(-max);
                        return { ...d, peasantUids, rooms: [] };
                      });
                    } else if (draft.action === 'kill') {
                      setDraft((d) => ({ ...d, peasantUids: [c.uid], rooms: [] }));
                    }
                  }}
                />
              ))}
              {state.bistro.length === 0 && <div className="tiny">Empty (peasants land here)</div>}
            </div>
          </div>
          <div>
            <div className="rooms">
              {state.rooms.slice(4, 8).map((r) => (
                <RoomCell
                  key={r.number}
                  room={r}
                  legal={welcomeRooms.has(r.number) || ((draft.action === 'bribe' || draft.action === 'kill') && !!r.guest) || (draft.action === 'build' && !!draft.cardUid)}
                  selected={draft.rooms.includes(r.number) || draft.extraRoom === r.number}
                  onClick={() => onRoom(r.number)}
                />
              ))}
            </div>
          </div>
          <div className="stack-pile">
            <h3>Wealth 0–40</h3>
            <div className="wealth">
              {state.players.map((p) => (
                <div className="disk" key={p.id}>
                  <span className={`key-dot key-${p.color}`} /> {p.name}: {p.cash}F
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="side">
        <h3>Action</h3>
        {state.phase === 'night' && actor.isHuman && (
          <>
            <div className="actions">
              {(['bribe', 'build', 'kill', 'bury', 'pass'] as const).map((a) => (
                <button
                  key={a}
                  className={`btn small${draft.action === a ? ' active' : ''}`}
                  onClick={() => setDraft({ ...empty(), action: a })}
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="tiny">{draft.action ? noteForAction(draft.action) : 'Choose an action. Highlighted rooms and cards are legal targets.'}</p>
            {draft.action === 'pass' && (
              <div className="tiny">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.launderDir === 'toChecks'}
                    onChange={(e) => setDraft((d) => ({ ...d, launderDir: e.target.checked ? 'toChecks' : null }))}
                  />{' '}
                  Cash → checks
                </label>
                <br />
                <label>
                  <input
                    type="checkbox"
                    checked={draft.launderDir === 'toCash'}
                    onChange={(e) => setDraft((d) => ({ ...d, launderDir: e.target.checked ? 'toCash' : null }))}
                  />{' '}
                  Checks → cash
                </label>
                {draft.launderDir && (
                  <div>
                    Count:{' '}
                    <input
                      type="number"
                      min={1}
                      value={draft.launderN}
                      onChange={(e) => setDraft((d) => ({ ...d, launderN: Number(e.target.value) }))}
                      style={{ width: 64, background: '#120c09', color: 'inherit', border: '1px solid #4a3424' }}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={confirm} disabled={busy}>
                Confirm action
              </button>
              <button className="btn" onClick={() => setDraft(empty())}>
                Cancel
              </button>
            </div>
          </>
        )}
        {(state.phase === 'wages' || state.phase === 'police' || state.phase === 'endGrave') && actor.isHuman && (
          <button className="btn primary" onClick={confirm}>
            {state.phase === 'wages' ? `Send ${actor.unpaid ?? 0} unpaid away` : 'Pay the gravedigger'}
          </button>
        )}
        {state.phase === 'welcome' && needsHuman(state) && (
          <p className="tiny">Click a highlighted open room to seat the arriving guest.</p>
        )}
        {busy && <p className="tiny">The house is thinking…</p>}
        <div className="err">{err}</div>
        {state.phase === 'gameOver' && state.scores && (
          <div>
            <h3>Final loot</h3>
            {state.scores.map((s) => {
              const p = state.players.find((x) => x.id === s.playerId)!;
              const win = state.winnerIds.includes(s.playerId);
              return (
                <div key={s.playerId} className="tiny" style={{ marginTop: 6 }}>
                  {p.name}: {s.loot}F ({s.cash} cash + {s.checks}×10)
                  {win ? ' — winner' : ''}
                </div>
              );
            })}
          </div>
        )}
        <p className="footer-note">Money on bury only. 40F cash cap. Peasants never enter the entrance stack.</p>
      </aside>

      <div className="hand-bar">
        <div className="tiny" style={{ marginBottom: 6 }}>
          {actor.isHuman ? 'Your hand — click a Build target first, then payment cards' : `${actor.name}'s turn`}
        </div>
        <div className="hand-row">
          {actor.hand.map((c) => (
            <GuestCard
              key={c.uid}
              card={c}
              selected={draft.payment.includes(c.uid) || draft.cardUid === c.uid}
              legal={(state.phase === 'night' && actor.isHuman && !!draft.action) || (state.phase === 'wages' && actor.isHuman)}
              onClick={() => onHand(c.uid)}
            />
          ))}
          {actor.hand.length === 0 && <div className="tiny">Empty hand</div>}
        </div>
      </div>

      {showExit && (
        <div className="modal-back" onClick={() => setShowExit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Exit stack</h3>
            <p className="tiny">Living side. Season 2 shuffle + rank-3 color scoring.</p>
            <div className="bistro-row" style={{ marginTop: 12 }}>
              {state.exit.map((c) => (
                <GuestCard key={c.uid} card={c} compact />
              ))}
              {state.exit.length === 0 && <div className="tiny">None yet</div>}
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowExit(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomCell(props: {
  room: GameState['rooms'][0];
  legal?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  const r = props.room;
  const closed = r.keyColor === null;
  return (
    <div
      className={`room${closed ? ' closed' : ' open'}${props.legal ? ' legal' : ''}${props.selected ? ' selected' : ''}`}
      onClick={closed ? undefined : props.onClick}
    >
      <div className="tag">
        <span>Room {r.number}</span>
        <span>
          {r.keyColor && <span className={`key-dot key-${r.keyColor}`} />}
          {r.roomServiceOwner != null ? <span className="rs"> RS</span> : null}
        </span>
      </div>
      {r.guest ? <GuestCard card={r.guest} compact /> : <div className="tiny">{closed ? 'Closed' : 'Vacant'}</div>}
    </div>
  );
}

function label(state: GameState): string {
  const a = getActor(state);
  switch (state.phase) {
    case 'welcome':
      return 'Evening · Welcome';
    case 'night':
      return `Night · pulse ${state.nightPulse} · ${a?.name ?? ''}`;
    case 'police':
      return 'Morning · investigation';
    case 'wages':
      return 'Morning · wages';
    case 'endGrave':
      return 'End-game gravedigger';
    case 'gameOver':
      return 'Game over';
  }
}

function hint(state: GameState): string {
  switch (state.phase) {
    case 'welcome':
      return 'Welcome: first player fills open rooms from the public entrance.';
    case 'night':
      return `Night pulse ${state.nightPulse} — ${getActor(state)?.name}. Two pulses of one action each.`;
    case 'police':
      return 'Police remain in an open room. Pay 10F per unburied corpse; bodies go to the box.';
    case 'wages':
      return 'Select unpaid accomplices to send away (travelers → exit, peasants → bistro).';
    case 'endGrave':
      return 'Final gravedigger, then rank-3 annex scoring (40F-capped).';
    case 'gameOver':
      return 'Score = cash + 10F per check. Tie-break: corpses under your annexes.';
  }
}

function tone(kind: string): string {
  if (kind === 'bury' || kind === 'service' || kind === 'leave') return 'money';
  if (kind === 'kill') return 'blood';
  if (kind === 'police') return 'police';
  return 'info';
}

function toMove(state: GameState, d: Draft): Move | string {
  const p = getActor(state);
  if (!p || !d.action) return 'Choose an action';
  if (d.action === 'pass') {
    if (!d.launderDir) return { type: 'pass' };
    return { type: 'pass', launder: { dir: d.launderDir, n: d.launderN } };
  }
  if (d.action === 'bribe') {
    if (d.peasantUids.length) {
      return { type: 'bribe', rooms: [], peasantUids: d.peasantUids, payment: [] };
    }
    if (!d.rooms.length) return 'Pick a bribe target';
    const ranks = d.rooms.reduce((n, id) => n + def(state.rooms.find((r) => r.number === id)!.guest!).rank, 0);
    const cost = paymentNeeded(p, 'bribe', ranks, true);
    if (d.payment.length !== cost && d.payment.length !== paymentNeeded(p, 'bribe', ranks, false)) {
      return `Pay ${cost} accomplice(s)`;
    }
    return { type: 'bribe', rooms: d.rooms, peasantUids: [], payment: d.payment };
  }
  if (d.action === 'kill') {
    if (d.peasantUids.length) {
      return { type: 'kill', rooms: [], peasantUid: d.peasantUids[0], payment: [] };
    }
    if (!d.rooms.length) return 'Pick a kill target';
    const ranks = d.rooms.reduce((n, id) => n + def(state.rooms.find((r) => r.number === id)!.guest!).rank, 0);
    const cost = paymentNeeded(p, 'kill', ranks, true);
    if (d.payment.length !== cost) return `Pay ${cost} accomplice(s)`;
    return { type: 'kill', rooms: d.rooms, peasantUid: null, payment: d.payment };
  }
  if (d.action === 'build') {
    if (!d.cardUid) return 'Pick a hand card with an annex';
    const card = p.hand.find((c) => c.uid === d.cardUid);
    if (!card) return 'Missing build target';
    const cost = paymentNeeded(p, 'build', def(card).rank, true);
    if (d.payment.length !== cost && d.payment.length !== paymentNeeded(p, 'build', def(card).rank, false)) {
      return `Pay ${cost} other accomplice(s)`;
    }
    const occ = def(card).annex?.id;
    const extra: Partial<Extract<Move, { type: 'build' }>> = {};
    if (occ === 'roomService') {
      if (d.extraRoom == null) return 'Click a room for Room Service';
      extra.roomServiceRoom = d.extraRoom;
    }
    if (occ === 'bedroom' && d.extraRoom != null) extra.monkRoom = d.extraRoom;
    return { type: 'build', cardUid: d.cardUid, payment: d.payment, ...extra };
  }
  if (d.action === 'bury') {
    if (!d.corpseUids.length) return 'Pick a corpse';
    if (!d.annexUid) return 'Pick an annex with spare capacity';
    const ranks = d.corpseUids.reduce((n, id) => n + def(p.unburied.find((c) => c.uid === id)!).rank, 0);
    const cost = paymentNeeded(p, 'bury', ranks, true);
    if (d.payment.length !== cost && d.payment.length !== paymentNeeded(p, 'bury', ranks, false)) {
      return `Pay ${cost} accomplice(s)`;
    }
    return {
      type: 'bury',
      corpses: d.corpseUids.map((uid) => ({ uid, annexUid: d.annexUid! })),
      payment: d.payment,
    };
  }
  return 'Unknown';
}

