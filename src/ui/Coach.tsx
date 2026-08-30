import type { GameState } from '../engine/types';

export type LessonId =
  | 'welcome'
  | 'night'
  | 'bribe'
  | 'build'
  | 'kill'
  | 'bury'
  | 'pass'
  | 'police'
  | 'wages'
  | 'score';

export const ALL_LESSONS: LessonId[] = [
  'welcome',
  'night',
  'bribe',
  'build',
  'kill',
  'bury',
  'pass',
  'police',
  'wages',
  'score',
];

const COPY: Record<LessonId, { title: string; body: string }> = {
  welcome: {
    title: 'Evening — Welcome',
    body: 'The top of the entrance is public. Place each arriving guest in an open empty room. Room-service tokens pay the owner the guest’s rank when they sit down. Keys mark who is paid 1F when guests leave alive in the morning.',
  },
  night: {
    title: 'Night — two pulses',
    body: 'Everyone takes one action, then everyone takes a second. You may repeat the same action. Pass is always legal. Affinity cards (merchants bribe, artisans build, police kill, clergy bury) return to your hand after you pay with them.',
  },
  bribe: {
    title: 'Bribe',
    body: 'Recruit a guest from any room (pay cards equal to their rank) or take 1–2 peasants from the bistro for free. Bribed guests become accomplices in hand. Police in hand do not investigate.',
  },
  build: {
    title: 'Build',
    body: 'Play a traveler from your hand as an annex. Pay other cards equal to its rank. Police and peasants cannot be built. The barn you start with is a rank-1 annex — capacity 1 body.',
  },
  kill: {
    title: 'Kill',
    body: 'Flip a room guest (or bistro peasant) onto your table, dead side up. You gain no money yet. Unburied corpses are a liability if police are still in the inn at dawn.',
  },
  bury: {
    title: 'Bury',
    body: 'Tuck one of your corpses under an annex with spare capacity (capacity = rank). Buried under your own annex: you take the full pocket. Under an opponent’s: you share. Rank 0 annexes hold nobody.',
  },
  pass: {
    title: 'Pass & the notary',
    body: 'Skip the grisly work. Optionally launder: cash → 10F checks, or cash a check for 10F (still capped at 40F on the track). One direction per pass. Checks are not wages.',
  },
  police: {
    title: 'Morning — investigation',
    body: 'If any police card remains in an open room, everyone with an unburied corpse pays 10F per body (cash and/or checks) and those corpses leave the game. Bribe or kill the officers at night to skip this.',
  },
  wages: {
    title: 'Wages',
    body: 'Pay 1F cash per accomplice in hand. A Distillery skips one. If you hit 0F with unpaid help, those cards leave (travelers to the exit, peasants to the bistro).',
  },
  score: {
    title: 'The tally',
    body: 'Richest innkeeper wins: cash on the 0–40 track + 10F per check. Tie-break: most corpses buried under your own annexes. Rank-3 parks/groceries/etc. score matching colors in the Exit stack only.',
  },
};

export function nextLesson(done: Set<LessonId>, state: GameState): LessonId | null {
  if (state.phase === 'gameOver') return 'score';
  if (state.phase === 'welcome' && !done.has('welcome')) return 'welcome';
  if (state.phase === 'night' && !done.has('night')) return 'night';
  if (state.phase === 'police' && !done.has('police')) return 'police';
  if (state.phase === 'wages' && !done.has('wages')) return 'wages';
  for (const id of ['bribe', 'kill', 'build', 'bury', 'pass'] as LessonId[]) {
    if (!done.has(id) && state.phase === 'night') return id;
  }
  if (!done.has('police')) return 'police';
  if (!done.has('wages')) return 'wages';
  if (!done.has('score')) return 'score';
  return null;
}

export function Coach(props: { state: GameState; done: Set<LessonId> }) {
  const id = nextLesson(props.done, props.state);
  const lesson = id ? COPY[id] : null;
  const remaining = ALL_LESSONS.filter((l) => !props.done.has(l)).length;
  return (
    <aside className="coach" aria-live="polite">
      <h2>Coach</h2>
      {lesson ? (
        <>
          <h3>{lesson.title}</h3>
          <p>{lesson.body}</p>
        </>
      ) : (
        <p>You’ve seen every teaching beat. Finish the short inn however you like — legal moves stay highlighted.</p>
      )}
      <p className="coach-progress">{Math.max(0, ALL_LESSONS.length - remaining)}/{ALL_LESSONS.length} beats</p>
    </aside>
  );
}

export function noteForAction(kind: string): string {
  switch (kind) {
    case 'bribe':
      return 'Why it matters: accomplices pay for later kills and burials; merchants bounce back on bribe.';
    case 'build':
      return 'Why it matters: annexes hold bodies and unlock discounts. Money still waits for burial.';
    case 'kill':
      return 'Why it matters: corpses are future pockets — and a police liability until buried.';
    case 'bury':
      return 'Why it matters: this is the only time pocket francs become cash.';
    case 'pass':
      return 'Why it matters: the 40F cap makes checks the way to bank a fortune.';
    default:
      return '';
  }
}
