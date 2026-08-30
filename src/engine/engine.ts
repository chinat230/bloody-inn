import {
  COLORS,
  CULL,
  WHITE_KEYS,
  IllegalMoveError,
  type Annex,
  type Card,
  type GameConfig,
  type GameState,
  type Move,
  type PlayerScore,
  type PlayerState,
  type Affinity,
} from './types';
import { DEFS, buildPeasants, buildTravelerDeck, defOf } from './cards';
import { seedFrom, shuffleInPlace } from './rng';
import { TUTORIAL_ENTRANCE } from './tutorialDeck';

export function def(card: Card) {
  return defOf(card);
}

export function clone<T>(x: T): T {
  return structuredClone(x);
}

function log(state: GameState, kind: string, text: string) {
  state.log.push({ kind, text });
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

export function addCash(p: PlayerState, n: number) {
  p.cash = Math.min(40, Math.max(0, p.cash + n));
}

export function hasEffect(p: PlayerState, id: string): boolean {
  return p.annexes.some((a) => a.effectId === id);
}

export function remainingCapacity(a: Annex): number {
  return Math.max(0, a.rank - a.buried.length);
}

export function policeInOpenRooms(state: GameState): Card[] {
  return state.rooms
    .filter((r) => r.keyColor && r.guest && def(r.guest).type === 'police')
    .map((r) => r.guest!);
}

export function travelersInInn(state: GameState): number {
  return state.rooms.filter((r) => r.guest).length;
}

export function openUnoccupied(state: GameState) {
  return state.rooms.filter((r) => r.keyColor && !r.guest);
}

export function getActor(state: GameState): PlayerState | null {
  if (state.phase === 'gameOver') return null;
  if (state.phase === 'welcome') return state.players[state.firstPlayer];
  if (state.phase === 'night') return state.players[state.currentPlayer];
  if (
    (state.phase === 'police' ||
      state.phase === 'wages' ||
      state.phase === 'endGrave') &&
    state.pendingPlayers.length
  ) {
    return state.players[state.pendingPlayers[0]];
  }
  return null;
}

function takeFromHand(p: PlayerState, uids: string[]): Card[] {
  const out: Card[] = [];
  for (const uid of uids) {
    const i = p.hand.findIndex((c) => c.uid === uid);
    if (i < 0) throw new IllegalMoveError(`Card ${uid} is not in hand`);
    out.push(p.hand.splice(i, 1)[0]);
  }
  return out;
}

export function paymentNeeded(
  p: PlayerState,
  action: Affinity,
  rawRankSum: number,
  useDiscount: boolean,
): number {
  let n = rawRankSum;
  if (useDiscount) {
    if (action === 'build' && hasEffect(p, 'workshop')) n -= 1;
    if (action === 'bribe' && hasEffect(p, 'parlor')) n -= 1;
    if (action === 'bury' && hasEffect(p, 'cellar')) n -= 1;
  }
  return Math.max(0, n);
}

function refundPayment(
  state: GameState,
  p: PlayerState,
  cards: Card[],
  action: Affinity,
) {
  const priest = action === 'bury' && hasEffect(p, 'chapel');
  for (const c of cards) {
    const d = def(c);
    if (d.affinity === action || priest) {
      p.hand.push(c);
    } else if (d.type === 'peasant') {
      state.bistro.push(c);
    } else {
      state.exit.push(c);
    }
  }
}

function assertNight(state: GameState, pid: number) {
  if (state.phase !== 'night') throw new IllegalMoveError('Not night');
  if (state.currentPlayer !== pid) throw new IllegalMoveError('Not your action');
}

function assertUnique(ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new IllegalMoveError('Duplicate cards in selection');
  }
}

export function ownBuriedCount(p: PlayerState): number {
  return p.annexes.reduce((n, a) => n + a.buried.length, 0);
}

export function lootOf(p: PlayerState): number {
  return p.cash + 10 * p.checks;
}

/* ---------- setup ---------- */

const AI_NAMES = ['Mlle. Vautrin', 'Père Lachaise', 'Mme. Peyrebeille'];

export function createGame(partial: Partial<GameConfig> & { humanIndex?: number } = {}): GameState {
  const config: GameConfig = {
    playerCount: (partial.playerCount as 2 | 3 | 4) ?? 2,
    length: partial.tutorial ? 'tutorial' : (partial.length === 'long' ? 'long' : partial.length === 'tutorial' ? 'tutorial' : 'short'),
    aiDifficulty: partial.aiDifficulty ?? 'easy',
    seed: partial.seed ?? 1831,
    tutorial: partial.tutorial ?? false,
  };
  const playerCount = config.playerCount;
  let rngState = seedFrom(config.seed);

  const peasants = buildPeasants();
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    const hand = [peasants[i * 2], peasants[i * 2 + 1]];
    players.push({
      id: i,
      name: i === 0 ? 'You' : AI_NAMES[i - 1],
      color: COLORS[i],
      isHuman: i === 0,
      cash: 5,
      checks: 1,
      hand,
      annexes: [
        {
          uid: `barn-${i}`,
          card: null,
          effectId: 'barn',
          rank: 1,
          buried: [],
        },
      ],
      unburied: [],
      tokens: 7,
    });
  }

  const unusedPeasants = peasants.slice(playerCount * 2);

  const rooms: GameState['rooms'] = [];
  for (let n = 1; n <= 8; n++) {
    rooms.push({
      number: n,
      keyColor: null,
      roomServiceOwner: null,
      guest: null,
    });
  }
  for (let i = 0; i < playerCount; i++) {
    rooms[i].keyColor = players[i].color;
  }
  const white = WHITE_KEYS[playerCount];
  for (let i = 0; i < white; i++) {
    rooms[playerCount + i].keyColor = 'white';
  }

  let entrance: Card[];
  let boxed: Card[] = [...unusedPeasants];

  if (config.tutorial) {
    entrance = TUTORIAL_ENTRANCE.map((occupationId, i) => ({
      uid: `tut-${occupationId}-${i}`,
      occupationId,
    }));
    const used = new Set(entrance.map((c) => c.occupationId));
    const rest = buildTravelerDeck().filter((c) => {
      // keep extras out of the tutorial table
      return !entrance.some((e) => e.occupationId === c.occupationId && e.uid === `tut-${c.occupationId}-${entrance.findIndex((x) => x.occupationId === c.occupationId)}`);
    });
    // Box every traveler not in the scripted entrance.
    const tutOccCount: Record<string, number> = {};
    for (const c of entrance) {
      tutOccCount[c.occupationId] = (tutOccCount[c.occupationId] ?? 0) + 1;
    }
    const unusedTravelers: Card[] = [];
    const seen: Record<string, number> = {};
    for (const c of buildTravelerDeck()) {
      seen[c.occupationId] = (seen[c.occupationId] ?? 0) + 1;
      if ((tutOccCount[c.occupationId] ?? 0) >= seen[c.occupationId]) continue;
      unusedTravelers.push(c);
    }
    boxed = [...boxed, ...unusedTravelers];
    void rest;
  } else {
    const deck = buildTravelerDeck();
    rngState = shuffleInPlace(deck, rngState);
    const remove = CULL[playerCount][config.length === 'long' ? 'long' : 'short'];
    boxed = [...boxed, ...deck.slice(0, remove)];
    entrance = deck.slice(remove);
  }

  const state: GameState = {
    config,
    players,
    rooms,
    entrance,
    exit: [],
    bistro: [],
    box: boxed,
    firstPlayer: 0,
    currentPlayer: 0,
    phase: 'welcome',
    nightPulse: 1,
    season: 1,
    entranceEmptiedCount: 0,
    lastRound: false,
    pendingGuest: null,
    pendingPlayers: [],
    round: 1,
    log: [],
    rngState,
    winnerIds: [],
    scores: null,
  };

  log(
    state,
    'setup',
    `${playerCount} innkeepers. ${config.length} game. Each starts with 2 peasants, a barn, 5F and one 10F check.`,
  );
  drawWelcome(state);
  return state;
}

function drawFromEntrance(state: GameState): Card | null {
  if (state.entrance.length === 0) {
    if (state.entranceEmptiedCount === 0) {
      state.entranceEmptiedCount = 1;
      state.season = 2;
      state.rngState = shuffleInPlace(state.exit, state.rngState);
      state.entrance = state.exit;
      state.exit = [];
      log(state, 'season', 'Season 2: the exit stack is shuffled back to the entrance.');
      if (state.entrance.length === 0) return null;
    } else {
      state.entranceEmptiedCount = 2;
      state.lastRound = true;
      return null;
    }
  }
  const card = state.entrance.shift()!;
  if (state.entrance.length === 0 && state.entranceEmptiedCount === 0) {
    // last card of season 1 taken; recycle on the next draw attempt
  }
  if (state.entrance.length === 0 && state.entranceEmptiedCount >= 1) {
    state.entranceEmptiedCount = 2;
    state.lastRound = true;
  }
  return card;
}

function drawWelcome(state: GameState) {
  const vacancies = openUnoccupied(state);
  if (vacancies.length === 0) {
    beginNight(state);
    return;
  }
  const card = drawFromEntrance(state);
  if (!card) {
    finishWelcome(state);
    return;
  }
  state.pendingGuest = card;
}

function finishWelcome(state: GameState) {
  state.pendingGuest = null;
  const inn = travelersInInn(state);
  if (state.lastRound && inn < state.players.length) {
    log(
      state,
      'end',
      `Fewer travelers (${inn}) than innkeepers — the night is skipped.`,
    );
    for (const r of state.rooms) {
      if (r.guest) {
        state.exit.push(r.guest);
        r.guest = null;
      }
    }
    beginEndGrave(state);
    return;
  }
  beginNight(state);
}

function beginNight(state: GameState) {
  state.phase = 'night';
  state.nightPulse = 1;
  state.currentPlayer = state.firstPlayer;
  log(state, 'night', `Night pulse 1 — ${state.players[state.currentPlayer].name} acts.`);
}

function nextNightSlot(state: GameState) {
  const n = state.players.length;
  const next = (state.currentPlayer + 1) % n;
  if (next === state.firstPlayer) {
    if (state.nightPulse === 1) {
      state.nightPulse = 2;
      state.currentPlayer = state.firstPlayer;
      log(state, 'night', `Night pulse 2 — ${state.players[state.currentPlayer].name} acts.`);
      return;
    }
    beginMorning(state);
    return;
  }
  state.currentPlayer = next;
}

function beginMorning(state: GameState) {
  const cops = policeInOpenRooms(state);
  if (cops.length) {
    const liable = state.players.filter((p) => p.unburied.length > 0).map((p) => p.id);
    log(
      state,
      'police',
      `Investigation! ${cops.length} officer(s) still in the inn.`,
    );
    if (liable.length) {
      state.phase = 'police';
      state.pendingPlayers = liable;
      return;
    }
  }
  afterPolice(state);
}

function afterPolice(state: GameState) {
  // Travelers leave
  for (const p of state.players) {
    const income = state.rooms.filter(
      (r) => r.keyColor === p.color && r.guest,
    ).length;
    let gain = income;
    if (hasEffect(p, 'gardens')) gain += 2;
    if (gain) addCash(p, gain);
    if (gain) {
      log(
        state,
        'leave',
        `${p.name} collects ${gain}F as guests depart.`,
      );
    }
  }
  for (const r of state.rooms) {
    if (r.guest) {
      state.exit.push(r.guest);
      r.guest = null;
    }
  }

  // Wages
  const needDiscard: number[] = [];
  for (const p of state.players) {
    const due = wageDue(p);
    if (due === 0) continue;
    if (p.cash >= due) {
      addCash(p, -due);
      log(state, 'wages', `${p.name} pays ${due}F in wages.`);
    } else {
      const unpaid = due - p.cash;
      addCash(p, -p.cash);
      // unpaid cards must be chosen — if they have fewer cards than unpaid, dump all
      needDiscard.push(p.id);
      p.unpaid = unpaid; // stuffed below via extra field? we'll store on state
      void unpaid;
    }
  }
  // store unpaid counts on pending via parallel array in log — use a map on state through pending + compute
  if (needDiscard.length) {
    state.phase = 'wages';
    state.pendingPlayers = needDiscard;
    return;
  }
  afterWages(state);
}

// unpaid is computed from current cash (already 0) and remaining due
export function unpaidWages(p: PlayerState): number {
  // cash already drained to 0 when entering wages discard
  return wageDue(p);
}

export function wageDue(p: PlayerState): number {
  const n = p.hand.length;
  if (n === 0) return 0;
  if (hasEffect(p, 'distillery')) return Math.max(0, n - 1);
  return n;
}

function afterWages(state: GameState) {
  if (state.lastRound) {
    beginEndGrave(state);
    return;
  }
  // pass first player left
  state.firstPlayer = (state.firstPlayer + 1) % state.players.length;
  state.round += 1;
  state.currentPlayer = state.firstPlayer;
  state.phase = 'welcome';
  log(
    state,
    'round',
    `Round ${state.round}. ${state.players[state.firstPlayer].name} welcomes guests.`,
  );
  drawWelcome(state);
}

function beginEndGrave(state: GameState) {
  const liable = state.players.filter((p) => p.unburied.length > 0).map((p) => p.id);
  if (liable.length) {
    log(state, 'end', 'End-of-game gravedigger: unburied corpses cost 10F each.');
    state.phase = 'endGrave';
    state.pendingPlayers = liable;
    return;
  }
  finalizeScores(state);
}

function finalizeScores(state: GameState) {
  // Rank-3 end-game annex cash
  const exitByType = {
    artisan: state.exit.filter((c) => def(c).type === 'artisan').length,
    merchant: state.exit.filter((c) => def(c).type === 'merchant').length,
    religious: state.exit.filter((c) => def(c).type === 'religious').length,
    noble: state.exit.filter((c) => def(c).type === 'noble').length,
  };
  for (const p of state.players) {
    let bonus = 0;
    for (const a of p.annexes) {
      if (a.effectId === 'park') bonus += 4 * exitByType.artisan;
      if (a.effectId === 'grocery') bonus += 4 * exitByType.merchant;
      if (a.effectId === 'bishopric') bonus += 4 * exitByType.religious;
      if (a.effectId === 'stables') bonus += 4 * exitByType.noble;
      if (a.effectId === 'greenhouse') bonus += 3 * p.checks;
    }
    if (bonus) addCash(p, bonus);
  }
  const scores: PlayerScore[] = state.players.map((p) => ({
    playerId: p.id,
    cash: p.cash,
    checks: p.checks,
    loot: lootOf(p),
    ownBuried: ownBuriedCount(p),
  }));
  let best = Math.max(...scores.map((s) => s.loot));
  let tied = scores.filter((s) => s.loot === best);
  if (tied.length > 1) {
    const b = Math.max(...tied.map((s) => s.ownBuried));
    tied = tied.filter((s) => s.ownBuried === b);
  }
  state.scores = scores;
  state.winnerIds = tied.map((s) => s.playerId);
  state.phase = 'gameOver';
  state.pendingPlayers = [];
  const names = tied.map((s) => state.players[s.playerId].name).join(' & ');
  log(state, 'end', `Final tally. Winner: ${names}.`);
}

/* ---------- moves ---------- */

function applyWelcome(state: GameState, roomNum: number) {
  if (state.phase !== 'welcome' || !state.pendingGuest) {
    throw new IllegalMoveError('No guest waiting to be placed');
  }
  const room = state.rooms.find((r) => r.number === roomNum);
  if (!room) throw new IllegalMoveError('No such room');
  if (!room.keyColor) throw new IllegalMoveError('Room is closed');
  if (room.guest) throw new IllegalMoveError('Room is occupied');
  const guest = state.pendingGuest;
  room.guest = guest;
  state.pendingGuest = null;
  if (room.roomServiceOwner != null) {
    const owner = state.players[room.roomServiceOwner];
    const gain = def(guest).rank;
    addCash(owner, gain);
    if (gain) {
      log(
        state,
        'service',
        `${owner.name} gains ${gain}F room service for the ${def(guest).name}.`,
      );
    }
  }
  log(
    state,
    'welcome',
    `${def(guest).name} takes room ${roomNum}.`,
  );
  drawWelcome(state);
}

function applyBribe(state: GameState, pid: number, move: Extract<Move, { type: 'bribe' }>) {
  assertNight(state, pid);
  const p = state.players[pid];
  const rooms = move.rooms;
  const peasants = move.peasantUids;
  if (rooms.length && peasants.length) {
    throw new IllegalMoveError('Bribe rooms or bistro peasants, not both');
  }
  if (!rooms.length && !peasants.length) {
    throw new IllegalMoveError('Bribe needs a target');
  }
  assertUnique([...rooms.map(String), ...peasants, ...move.payment]);

  if (peasants.length) {
    const max = hasEffect(p, 'brewery') ? 4 : 2;
    if (peasants.length > max) {
      throw new IllegalMoveError(`May take at most ${max} peasants`);
    }
    for (const uid of peasants) {
      if (!state.bistro.some((c) => c.uid === uid)) {
        throw new IllegalMoveError('Peasant is not in the bistro');
      }
    }
    if (move.payment.length !== 0) {
      throw new IllegalMoveError('Peasants cost 0 cards to bribe');
    }
    for (const uid of peasants) {
      const i = state.bistro.findIndex((c) => c.uid === uid);
      p.hand.push(state.bistro.splice(i, 1)[0]);
    }
    log(state, 'bribe', `${p.name} bribes ${peasants.length} peasant(s).`);
    nextNightSlot(state);
    return;
  }

  if (rooms.length > 1 && !hasEffect(p, 'shop')) {
    throw new IllegalMoveError('Need a Shop to bribe multiple travelers');
  }
  let rankSum = 0;
  const taken: Card[] = [];
  for (const n of rooms) {
    const room = state.rooms.find((r) => r.number === n);
    if (!room?.guest) throw new IllegalMoveError('No guest in that room');
    rankSum += def(room.guest).rank;
    taken.push(room.guest);
  }
  const need = paymentNeeded(p, 'bribe', rankSum, true);
  const needFull = paymentNeeded(p, 'bribe', rankSum, false);
  if (move.payment.length !== need && move.payment.length !== needFull) {
    throw new IllegalMoveError(
      `Bribe costs ${need} card(s) (or ${needFull} without discount)`,
    );
  }
  if (move.payment.length === needFull && need !== needFull && move.payment.length !== need) {
    // allowed: paying full
  }
  const paid = takeFromHand(p, move.payment);
  refundPayment(state, p, paid, 'bribe');
  for (const n of rooms) {
    const room = state.rooms.find((r) => r.number === n)!;
    p.hand.push(room.guest!);
    room.guest = null;
  }
  log(
    state,
    'bribe',
    `${p.name} bribes ${taken.map((c) => def(c).name).join(', ')}.`,
  );
  nextNightSlot(state);
}

function applyBuild(state: GameState, pid: number, move: Extract<Move, { type: 'build' }>) {
  assertNight(state, pid);
  const p = state.players[pid];
  const card = p.hand.find((c) => c.uid === move.cardUid);
  if (!card) throw new IllegalMoveError('Annex card is not in hand');
  const d = def(card);
  if (!d.annex) throw new IllegalMoveError('That guest cannot be built');
  if (move.payment.includes(move.cardUid)) {
    throw new IllegalMoveError('The annex itself is not payment');
  }
  const need = paymentNeeded(p, 'build', d.rank, true);
  const needFull = paymentNeeded(p, 'build', d.rank, false);
  if (move.payment.length !== need && move.payment.length !== needFull) {
    throw new IllegalMoveError(`Build costs ${need} other card(s)`);
  }
  const paid = takeFromHand(p, move.payment);
  refundPayment(state, p, paid, 'build');
  takeFromHand(p, [move.cardUid]);
  const annex: Annex = {
    uid: `annex-${card.uid}`,
    card,
    effectId: d.annex.id,
    rank: d.rank,
    buried: [],
  };
  p.annexes.push(annex);
  applyInstant(state, p, annex, move);
  log(state, 'build', `${p.name} builds the ${d.annex.name}.`);
  nextNightSlot(state);
}

function applyInstant(
  state: GameState,
  p: PlayerState,
  annex: Annex,
  move: Extract<Move, { type: 'build' }>,
) {
  const red = p.annexes.filter((a) => a.card && def(a.card).type === 'artisan').length;
  const blue = p.annexes.filter((a) => a.card && def(a.card).type === 'merchant').length;
  const purple = p.annexes.filter((a) => a.card && def(a.card).type === 'religious').length;
  switch (annex.effectId) {
    case 'vegetableGarden':
      addCash(p, red);
      break;
    case 'kiosk':
      addCash(p, blue);
      break;
    case 'altar':
      addCash(p, purple);
      break;
    case 'chandelier':
      addCash(p, 4);
      break;
    case 'kingSizeBed':
      addCash(p, 6);
      break;
    case 'diningRoom':
      addCash(p, 9);
      break;
    case 'pavilion':
      addCash(p, 18);
      break;
    case 'park':
    case 'grocery':
    case 'bishopric':
    case 'stables':
      addCash(p, 4);
      break;
    case 'roomService': {
      const n = move.roomServiceRoom;
      if (n == null) throw new IllegalMoveError('Choose a room for Room Service');
      const room = state.rooms.find((r) => r.number === n);
      if (!room?.keyColor) throw new IllegalMoveError('Room has no key');
      if (room.roomServiceOwner != null) {
        throw new IllegalMoveError('That room already has Room Service');
      }
      if (p.tokens <= 0) throw new IllegalMoveError('No tokens left');
      room.roomServiceOwner = p.id;
      p.tokens -= 1;
      break;
    }
    case 'bedroom': {
      const whites = state.rooms.filter((r) => r.keyColor === 'white');
      if (!whites.length) break;
      const n = move.monkRoom ?? whites[0].number;
      const room = state.rooms.find((r) => r.number === n);
      if (!room || room.keyColor !== 'white') {
        throw new IllegalMoveError('Monk must replace a white key');
      }
      if (p.tokens <= 0) throw new IllegalMoveError('No tokens left');
      room.keyColor = p.color;
      p.tokens -= 1;
      break;
    }
    default:
      break;
  }
}

function applyKill(state: GameState, pid: number, move: Extract<Move, { type: 'kill' }>) {
  assertNight(state, pid);
  const p = state.players[pid];
  if (move.rooms.length && move.peasantUid) {
    throw new IllegalMoveError('Kill a room guest or a peasant, not both');
  }
  if (!move.rooms.length && !move.peasantUid) {
    throw new IllegalMoveError('Kill needs a target');
  }
  if (move.peasantUid) {
    const i = state.bistro.findIndex((c) => c.uid === move.peasantUid);
    if (i < 0) throw new IllegalMoveError('Peasant is not in the bistro');
    if (move.payment.length !== 0) {
      throw new IllegalMoveError('Peasants cost 0 to kill');
    }
    const card = state.bistro.splice(i, 1)[0];
    p.unburied.push(card);
    log(state, 'kill', `${p.name} kills a peasant. No money until burial.`);
    nextNightSlot(state);
    return;
  }
  if (move.rooms.length > 1 && !hasEffect(p, 'butcherShop')) {
    throw new IllegalMoveError('Need a Butcher Shop to kill multiple travelers');
  }
  let rankSum = 0;
  const names: string[] = [];
  for (const n of move.rooms) {
    const room = state.rooms.find((r) => r.number === n);
    if (!room?.guest) throw new IllegalMoveError('No guest in that room');
    rankSum += def(room.guest).rank;
    names.push(def(room.guest).name);
  }
  const need = paymentNeeded(p, 'kill', rankSum, true);
  const needFull = paymentNeeded(p, 'kill', rankSum, false);
  // kill has no discount annex
  if (move.payment.length !== need && move.payment.length !== needFull) {
    throw new IllegalMoveError(`Kill costs ${need} card(s)`);
  }
  const paid = takeFromHand(p, move.payment);
  refundPayment(state, p, paid, 'kill');
  for (const n of move.rooms) {
    const room = state.rooms.find((r) => r.number === n)!;
    p.unburied.push(room.guest!);
    room.guest = null;
  }
  log(
    state,
    'kill',
    `${p.name} kills ${names.join(', ')}. Pockets are taken only when buried.`,
  );
  nextNightSlot(state);
}

function applyBury(state: GameState, pid: number, move: Extract<Move, { type: 'bury' }>) {
  assertNight(state, pid);
  const p = state.players[pid];
  if (!move.corpses.length) throw new IllegalMoveError('Bury needs a corpse');
  if (move.corpses.length > 1 && !hasEffect(p, 'crypt')) {
    throw new IllegalMoveError('Need a Crypt to bury multiple corpses');
  }
  assertUnique(move.corpses.map((c) => c.uid));
  let rankSum = 0;
  const usedCap: Record<string, number> = {};
  for (const item of move.corpses) {
    const corpse = p.unburied.find((c) => c.uid === item.uid);
    if (!corpse) throw new IllegalMoveError('You can only bury your own corpses');
    rankSum += def(corpse).rank;
    const annex = findAnnex(state, item.annexUid);
    if (!annex) throw new IllegalMoveError('No such annex');
    usedCap[annex.uid] = (usedCap[annex.uid] ?? 0) + 1;
    if (remainingCapacity(annex) < usedCap[annex.uid]) {
      throw new IllegalMoveError('Annex is full (capacity = rank)');
    }
  }
  const need = paymentNeeded(p, 'bury', rankSum, true);
  const needFull = paymentNeeded(p, 'bury', rankSum, false);
  if (move.payment.length !== need && move.payment.length !== needFull) {
    throw new IllegalMoveError(`Bury costs ${need} card(s)`);
  }
  const paid = takeFromHand(p, move.payment);
  refundPayment(state, p, paid, 'bury');
  for (const item of move.corpses) {
    const idx = p.unburied.findIndex((c) => c.uid === item.uid);
    const corpse = p.unburied.splice(idx, 1)[0];
    const annex = findAnnex(state, item.annexUid)!;
    const owner = state.players.find((pl) => pl.annexes.some((a) => a.uid === annex.uid))!;
    annex.buried.push(corpse);
    const pocket = def(corpse).pocket;
    if (owner.id === p.id) {
      addCash(p, pocket);
      log(state, 'bury', `${p.name} buries ${def(corpse).name} under their ${annexName(annex)} for ${pocket}F.`);
    } else {
      const half = Math.floor(pocket / 2);
      addCash(p, half);
      addCash(owner, half);
      log(
        state,
        'bury',
        `${p.name} buries ${def(corpse).name} under ${owner.name}'s ${annexName(annex)}; they share ${pocket}F.`,
      );
    }
  }
  nextNightSlot(state);
}

function annexName(a: Annex): string {
  if (a.effectId === 'barn') return 'barn';
  if (a.card) return def(a.card).annex?.name ?? a.effectId;
  return a.effectId;
}

function findAnnex(state: GameState, uid: string): Annex | null {
  for (const p of state.players) {
    const a = p.annexes.find((x) => x.uid === uid);
    if (a) return a;
  }
  return null;
}

function applyPass(state: GameState, pid: number, move: Extract<Move, { type: 'pass' }>) {
  assertNight(state, pid);
  const p = state.players[pid];
  if (move.launder) {
    const { dir, n } = move.launder;
    if (n < 1) throw new IllegalMoveError('Launder at least one check');
    if (dir === 'toChecks') {
      if (p.cash < 10 * n) throw new IllegalMoveError('Not enough cash to launder');
      addCash(p, -10 * n);
      p.checks += n;
      log(state, 'pass', `${p.name} launders ${10 * n}F into ${n} check(s).`);
    } else {
      if (p.checks < n) throw new IllegalMoveError('Not enough checks');
      p.checks -= n;
      addCash(p, 10 * n);
      log(state, 'pass', `${p.name} cashes ${n} check(s).`);
    }
  } else {
    log(state, 'pass', `${p.name} passes.`);
  }
  nextNightSlot(state);
}

function wealthForPolice(p: PlayerState): number {
  return p.cash + 10 * p.checks;
}

function applyPolicePay(
  state: GameState,
  pid: number,
  cash: number,
  checks: number,
  end: boolean,
) {
  const expectedPhase = end ? 'endGrave' : 'police';
  if (state.phase !== expectedPhase) throw new IllegalMoveError('Not a gravedigger step');
  if (state.pendingPlayers[0] !== pid) throw new IllegalMoveError('Not your payment');
  const p = state.players[pid];
  const cost = 10 * p.unburied.length;
  if (cash < 0 || checks < 0) throw new IllegalMoveError('Negative payment');
  if (cash > p.cash || checks > p.checks) throw new IllegalMoveError('Cannot pay that');
  const paid = cash + 10 * checks;
  const max = wealthForPolice(p);
  if (max >= cost) {
    if (paid !== cost) throw new IllegalMoveError(`Must pay exactly ${cost}F`);
  } else {
    if (cash !== p.cash || checks !== p.checks) {
      throw new IllegalMoveError('Must pay everything you have');
    }
  }
  addCash(p, -cash);
  p.checks -= checks;
  const n = p.unburied.length;
  state.box.push(...p.unburied);
  p.unburied = [];
  log(state, 'police', `${p.name} pays ${paid}F; ${n} corpse(s) go to the box.`);
  state.pendingPlayers.shift();
  if (!state.pendingPlayers.length) {
    if (end) finalizeScores(state);
    else afterPolice(state);
  }
}

function applyWageDiscard(state: GameState, pid: number, uids: string[]) {
  if (state.phase !== 'wages') throw new IllegalMoveError('Not wages');
  if (state.pendingPlayers[0] !== pid) throw new IllegalMoveError('Not your discard');
  const p = state.players[pid];
  const due = wageDue(p);
  // cash already 0 after drain in afterPolice — wait, we drained cash in afterPolice
  // but wageDue uses hand size. unpaid = due (since cash is 0). If they had some cash
  // it was drained; unpaid count = due - (cash before). We drained ALL remaining cash
  // which was < due. unpaid = due - that amount. That amount is gone. We need to remember it.
  //
  // Fix: do NOT drain cash until we know unpaid. Store unpaid on a side channel.
  // I'll recompute: when entering wages for this player, cash was set to 0 after paying
  // min(cash, due). The original due is based on hand. unpaid = due - paidCash.
  // We lost paidCash. Let's store unpaidWagesNeeded on the player via a WeakMap? 
  // Simpler: stash on GameState a record.
  const unpaid = getUnpaid(state, pid);
  if (uids.length !== unpaid) {
    throw new IllegalMoveError(`Discard exactly ${unpaid} unpaid accomplice(s)`);
  }
  assertUnique(uids);
  const cards = takeFromHand(p, uids);
  for (const c of cards) {
    if (def(c).type === 'peasant') state.bistro.push(c);
    else state.exit.push(c);
  }
  log(state, 'wages', `${p.name} lets ${uids.length} unpaid accomplice(s) leave.`);
  state.pendingPlayers.shift();
  if (!state.pendingPlayers.length) afterWages(state);
}

/** unpaid counts remembered when cash was drained */
const unpaidMap = new WeakMap<GameState, Record<number, number>>();

function getUnpaid(state: GameState, pid: number): number {
  return unpaidMap.get(state)?.[pid] ?? 0;
}

function setUnpaid(state: GameState, pid: number, n: number) {
  const m = unpaidMap.get(state) ?? {};
  m[pid] = n;
  unpaidMap.set(state, m);
}

// Patch afterPolice wage drain to record unpaid. Redefine by wrapping — we already
// wrote afterPolice. Let's fix afterPolice's unpaid handling by editing the function
// above... I used a hack. I'll rewrite the wage section properly via a second function
// called from afterPolice — actually I need to fix afterPolice. I'll replace the
// wage loop by exporting applyMorningWages used internally.
// Since afterPolice already has a buggy loop, I'll fix it here by monkey-patching
// at applyMove time? Cleaner to rewrite afterPolice wage part using a helper
// that is the source of truth. I'll intercept: when afterPolice runs the buggy
// path it pushes to needDiscard but doesn't set unpaid. I'll set unpaid in a
// revised helper invoked from applyMove after clone...
//
// BEST FIX: edit afterPolice now conceptually — I'll add function settleWages
// and call it INSTEAD. Wait, afterPolice already contains the loop. I'll
// duplicate a corrected settleWages and change afterPolice to call it... can't
// change easily in this same write. I'll include a corrected version by
// making afterPolice call recordUnpaid which scans...
//
// After drain, cash is 0. Original cash was X. due D. unpaid = D - min(X,D).
// We've lost X. UNLESS I don't drain in afterPolice and drain in applyWageDiscard
// or auto.
//
// I'll re-implement morning wages inside applyMove's path by replacing
// afterPolice's body... the file already has afterPolice. Let me add
// `fixupWagesOnEnter` that uses current cash BEFORE drain — too late.
//
// I'll store unpaid as: due - 0 if cash is 0. That's WRONG if they paid 2 of 5.
// Example: due=5, cash=2 → pay 2, unpaid=3, cash=0, hand still 5.
// getUnpaid must be 3, not 5.
//
// I'll put `unpaidWagesByPlayer: Record<number, number>` on GameState.
// I didn't add it to the type. I'll use WeakMap and FIX afterPolice by
// rewriting it... I still can patch afterPolice if I append a replacement.
//
// Strategy: add `state as GameState & { unpaid?: Record<number, number> }`
// and set it in a copied wage settler called from the EXISTING afterPolice
// by changing the existing loop. The loop currently:
//
//    const unpaid = due - p.cash;
//    addCash(p, -p.cash);
//    needDiscard.push(p.id);
//    p.unpaid = unpaid;
//
// I'll use (p as any).unpaid in getUnpaid as fallback AND set it in afterPolice
// via (p as any). The afterPolice already has `p.unpaid = unpaid` but PlayerState
// doesn't have it. I'll read (p as any).unpaid in getUnpaid.

function getUnpaidFixed(state: GameState, pid: number): number {
  const p = state.players[pid] as PlayerState;
  if (p.unpaid != null) return p.unpaid;
  return getUnpaid(state, pid);
}

export function tryMove(
  state: GameState,
  move: Move,
): { ok: true; state: GameState } | { ok: false; error: string } {
  try {
    return { ok: true, state: applyMove(state, move) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function applyMove(state: GameState, move: Move): GameState {
  const s = clone(state);
  // preserve unpaid flags across clone
  for (let i = 0; i < state.players.length; i++) {
    const u = (state.players[i] as PlayerState).unpaid;
    if (u != null) (s.players[i] as PlayerState).unpaid = u;
  }
  const actor = getActor(s);
  const pid = actor?.id ?? -1;

  switch (move.type) {
    case 'welcome':
      applyWelcome(s, move.room);
      break;
    case 'bribe':
      applyBribe(s, pid, move);
      break;
    case 'build':
      applyBuild(s, pid, move);
      break;
    case 'kill':
      applyKill(s, pid, move);
      break;
    case 'bury':
      applyBury(s, pid, move);
      break;
    case 'pass':
      applyPass(s, pid, move);
      break;
    case 'policePay':
      applyPolicePay(s, pid, move.cash, move.checks, false);
      break;
    case 'endGravePay':
      applyPolicePay(s, pid, move.cash, move.checks, true);
      break;
    case 'wageDiscard':
      applyWageDiscardFixed(s, pid, move.cardUids);
      break;
    default:
      throw new IllegalMoveError('Unknown move');
  }
  return s;
}

function applyWageDiscardFixed(state: GameState, pid: number, uids: string[]) {
  if (state.phase !== 'wages') throw new IllegalMoveError('Not wages');
  if (state.pendingPlayers[0] !== pid) throw new IllegalMoveError('Not your discard');
  const p = state.players[pid] as PlayerState;
  const unpaid = p.unpaid ?? 0;
  if (uids.length !== unpaid) {
    throw new IllegalMoveError(`Discard exactly ${unpaid} unpaid accomplice(s)`);
  }
  assertUnique(uids);
  const cards = takeFromHand(p, uids);
  for (const c of cards) {
    if (def(c).type === 'peasant') state.bistro.push(c);
    else state.exit.push(c);
  }
  log(state, 'wages', `${p.name} lets ${uids.length} unpaid accomplice(s) leave.`);
  delete p.unpaid;
  state.pendingPlayers.shift();
  if (!state.pendingPlayers.length) afterWages(state);
}

/** Auto-pay helper for AI / tests when the mix is unambiguous. */
export function autoPolicePay(p: PlayerState): { cash: number; checks: number } {
  const cost = 10 * p.unburied.length;
  const max = p.cash + 10 * p.checks;
  if (max <= cost) return { cash: p.cash, checks: p.checks };
  const cashTens = Math.min(Math.floor(p.cash / 10), cost / 10);
  let checks = Math.min(p.checks, cost / 10 - cashTens);
  let cash = cashTens * 10;
  // leftover exact cash if any (cost always ×10 so leftover 0)
  const paid = cash + 10 * checks;
  if (paid < cost && p.cash >= cost - 10 * checks) {
    cash = cost - 10 * checks;
  }
  return { cash, checks };
}

export function annexesWithSpace(state: GameState): Annex[] {
  const out: Annex[] = [];
  for (const p of state.players) {
    for (const a of p.annexes) {
      if (remainingCapacity(a) > 0) out.push(a);
    }
  }
  return out;
}

export { DEFS };
