/** Seeded 32-bit LCG. Same seed → same shuffle. */
export function nextRng(state: number): { state: number; value: number } {
  const s = (Math.imul(state, 1664525) + 1013904223) | 0;
  return { state: s, value: (s >>> 0) / 4294967296 };
}

export function shuffleInPlace<T>(arr: T[], rngState: number): number {
  let s = rngState;
  for (let i = arr.length - 1; i > 0; i--) {
    const n = nextRng(s);
    s = n.state;
    const j = Math.floor(n.value * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return s;
}

export function seedFrom(n: number): number {
  return (n | 0) === 0 ? 1 : n | 0;
}
