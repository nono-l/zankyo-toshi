/*
  シード文字列を決定論の乱数にする。Math.random は生成に使わない。
*/
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  return xmur3(s)();
}

export function makeRng(seed: string, stream = 0) {
  const n = (hashSeed(seed) ^ Math.imul(stream, 0x9e3779b9)) >>> 0;
  const rng = mulberry32(n);
  return {
    next: rng,
    range: (a: number, b: number) => a + rng() * (b - a),
    int: (a: number, b: number) => a + Math.floor(rng() * (b - a)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)]!,
    chance: (p: number) => rng() < p,
  };
}
