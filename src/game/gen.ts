/*
  シード決定論の地形。語彙は words.ts、描画は echoes.ts。
  SIZE は 62（旧 31 の二倍）。面積は約四倍。部屋数も増やしてスカスカを避けた。
  Rapier は入れない。歩行判定は walk 格子だけが知っている。
*/
import { createNoise2D } from "simplex-noise";
import { hashSeed, makeRng, mulberry32 } from "./rng";
import {
  composeCivName,
  composeCivRule,
  composeLandmarkName,
  composeRelicTitle,
  pickDistinct,
  REL_BODIES,
  type LandmarkKind,
} from "./words";

export type { LandmarkKind };

export const SIZE = 62;
export const CELL = 4;

export type RoomKind = "hall" | "chamber" | "shrine" | "flooded" | "atrium";

export type Room = {
  x: number;
  z: number;
  w: number;
  h: number;
  kind: RoomKind;
};

export type Relic = {
  id: number;
  x: number;
  y: number;
  z: number;
  title: string;
  body: string;
};

export type RuinWorld = {
  seed: string;
  size: number;
  cell: number;
  walk: Uint8Array;
  flooded: Uint8Array;
  openSky: Uint8Array;
  spawnX: number;
  spawnZ: number;
  rooms: Room[];
  relics: Relic[];
  civName: string;
  civRule: string;
  landmarkName: string;
  landmarkKind: LandmarkKind;
  landmark: { cx: number; cz: number; w: number; d: number };
  style: "stone" | "concrete" | "mixed";
};

function idx(x: number, z: number) {
  return z * SIZE + x;
}

function inBounds(x: number, z: number) {
  return x >= 0 && z >= 0 && x < SIZE && z < SIZE;
}

function carve(walk: Uint8Array, x: number, z: number, w: number, h: number) {
  const x0 = Math.max(1, x);
  const z0 = Math.max(1, z);
  const x1 = Math.min(SIZE - 1, x + w);
  const z1 = Math.min(SIZE - 1, z + h);
  for (let zz = z0; zz < z1; zz++) {
    for (let xx = x0; xx < x1; xx++) walk[idx(xx, zz)] = 1;
  }
}

function carveHall(
  walk: Uint8Array,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  wide: number,
) {
  const dx = Math.sign(x1 - x0);
  const dz = Math.sign(z1 - z0);
  let x = x0;
  let z = z0;
  while (x !== x1) {
    for (let k = 0; k < wide; k++) if (inBounds(x, z + k)) walk[idx(x, z + k)] = 1;
    x += dx;
  }
  while (z !== z1) {
    for (let k = 0; k < wide; k++) if (inBounds(x + k, z)) walk[idx(x + k, z)] = 1;
    z += dz;
  }
  for (let k = 0; k < wide; k++) {
    if (inBounds(x, z + k)) walk[idx(x, z + k)] = 1;
    if (inBounds(x + k, z)) walk[idx(x + k, z)] = 1;
  }
}

function flood(walk: Uint8Array, sx: number, sz: number): Uint8Array {
  const seen = new Uint8Array(SIZE * SIZE);
  const q: number[] = [];
  const start = idx(sx, sz);
  if (!walk[start]) return seen;
  seen[start] = 1;
  q.push(start);
  while (q.length) {
    const i = q.pop()!;
    const x = i % SIZE;
    const z = (i / SIZE) | 0;
    for (const [nx, nz] of [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ] as const) {
      if (!inBounds(nx, nz)) continue;
      const ni = idx(nx, nz);
      if (seen[ni] || !walk[ni]) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }
  return seen;
}

function cellCenter(i: number, j: number) {
  const o = (SIZE / 2) * CELL;
  return { x: i * CELL - o + CELL * 0.5, z: j * CELL - o + CELL * 0.5 };
}

export function worldToCell(x: number, z: number) {
  const o = (SIZE / 2) * CELL;
  return { i: Math.floor((x + o) / CELL), j: Math.floor((z + o) / CELL) };
}

export function generateRuin(seed: string): RuinWorld {
  const rng = makeRng(seed, 1);
  const noise = createNoise2D(mulberry32(hashSeed(seed) ^ 0x51ed));
  const walk = new Uint8Array(SIZE * SIZE);
  const flooded = new Uint8Array(SIZE * SIZE);
  const openSky = new Uint8Array(SIZE * SIZE);
  const rooms: Room[] = [];
  const target = rng.int(14, 22);
  let attempts = 0;
  while (rooms.length < target && attempts < 160) {
    attempts++;
    const w = rng.int(6, 11);
    const h = rng.int(6, 11);
    const x = rng.int(2, SIZE - w - 2);
    const z = rng.int(2, SIZE - h - 2);
    const pad = 1;
    if (
      rooms.some(
        (r) =>
          x < r.x + r.w + pad &&
          x + w + pad > r.x &&
          z < r.z + r.h + pad &&
          z + h + pad > r.z,
      )
    ) {
      continue;
    }
    rooms.push({
      x,
      z,
      w,
      h,
      kind: rng.pick(["hall", "chamber", "shrine"] as const),
    });
  }
  if (rooms.length < 3) {
    rooms.push({ x: 4, z: 4, w: 8, h: 7, kind: "hall" });
    rooms.push({ x: 16, z: 18, w: 7, h: 7, kind: "chamber" });
    rooms.push({ x: 8, z: 18, w: 6, h: 6, kind: "shrine" });
  }

  const atriumIdx = rng.int(0, rooms.length);
  const atrium = rooms[atriumIdx]!;
  atrium.kind = "atrium";
  atrium.w = Math.min(18, atrium.w + 4);
  atrium.h = Math.min(18, atrium.h + 4);
  if (atrium.x + atrium.w > SIZE - 2) atrium.x = SIZE - 2 - atrium.w;
  if (atrium.z + atrium.h > SIZE - 2) atrium.z = SIZE - 2 - atrium.h;

  const floodIdx = rooms.findIndex((_, i) => i !== atriumIdx);
  if (floodIdx >= 0) rooms[floodIdx]!.kind = "flooded";

  for (const r of rooms) carve(walk, r.x, r.z, r.w, r.h);

  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i]!;
    const b = rooms[i + 1]!;
    carveHall(
      walk,
      (a.x + (a.w >> 1)) | 0,
      (a.z + (a.h >> 1)) | 0,
      (b.x + (b.w >> 1)) | 0,
      (b.z + (b.h >> 1)) | 0,
      2,
    );
  }
  if (rooms.length > 3) {
    const a = rooms[0]!;
    const b = rooms[rooms.length - 1]!;
    carveHall(
      walk,
      (a.x + (a.w >> 1)) | 0,
      (a.z + (a.h >> 1)) | 0,
      (b.x + (b.w >> 1)) | 0,
      (b.z + (b.h >> 1)) | 0,
      2,
    );
  }

  const spawnRoom = rooms[0]!;
  const spawnI = spawnRoom.x + (spawnRoom.w >> 1);
  const spawnJ = spawnRoom.z + (spawnRoom.h >> 1);

  let reached = flood(walk, spawnI, spawnJ);
  for (const r of rooms) {
    const cx = r.x + (r.w >> 1);
    const cz = r.z + (r.h >> 1);
    if (reached[idx(cx, cz)]) continue;
    carveHall(walk, spawnI, spawnJ, cx, cz, 2);
    reached = flood(walk, spawnI, spawnJ);
  }

  for (let z = 2; z < SIZE - 2; z++) {
    for (let x = 2; x < SIZE - 2; x++) {
      if (!walk[idx(x, z)]) continue;
      const n = noise(x * 0.17, z * 0.17);
      if (n > 0.55 && rng.chance(0.35)) {
        if (walk[idx(x + 1, z)] && !walk[idx(x, z + 1)]) walk[idx(x, z + 1)] = 1;
      }
    }
  }

  for (const r of rooms) {
    if (r.kind !== "atrium") continue;
    for (let z = r.z; z < r.z + r.h; z++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (inBounds(x, z)) openSky[idx(x, z)] = 1;
      }
    }
  }

  for (let z = 1; z < SIZE - 1; z++) {
    for (let x = 1; x < SIZE - 1; x++) {
      if (!walk[idx(x, z)]) continue;
      if (noise(x * 0.09 + 20, z * 0.09) > 0.62) openSky[idx(x, z)] = 1;
    }
  }

  const floodedRoom = rooms.find((r) => r.kind === "flooded");
  if (floodedRoom) {
    for (let z = floodedRoom.z; z < floodedRoom.z + floodedRoom.h; z++) {
      for (let x = floodedRoom.x; x < floodedRoom.x + floodedRoom.w; x++) {
        if (inBounds(x, z) && walk[idx(x, z)]) flooded[idx(x, z)] = 1;
      }
    }
  }

  const landmarkKind = rng.pick(["atrium", "tower", "bridge"] as const);
  const style = rng.pick(["stone", "concrete", "mixed"] as const);
  const nameRng = makeRng(seed, 17);
  const civName = composeCivName(nameRng);
  const civRule = composeCivRule(nameRng);
  const landmarkName = composeLandmarkName(nameRng, landmarkKind);
  const relicTitlesUsed = new Set<string>();
  const relicBodies = pickDistinct(nameRng, REL_BODIES, 5);

  const relicRooms = rooms.filter((r) => r !== spawnRoom);
  const relics: Relic[] = [];
  const used = new Set<number>();
  for (let n = 0; n < 5; n++) {
    const r = relicRooms[n % relicRooms.length] ?? atrium;
    let placed = false;
    for (let t = 0; t < 12 && !placed; t++) {
      const i = r.x + rng.int(1, Math.max(2, r.w - 1));
      const j = r.z + rng.int(1, Math.max(2, r.h - 1));
      const key = idx(i, j);
      if (!walk[key] || used.has(key)) continue;
      used.add(key);
      const c = cellCenter(i, j);
      relics.push({
        id: n,
        x: c.x,
        y: 1.15,
        z: c.z,
        title: composeRelicTitle(nameRng, relicTitlesUsed),
        body: relicBodies[n] ?? REL_BODIES[n % REL_BODIES.length]!,
      });
      placed = true;
    }
  }

  const ac = cellCenter(atrium.x + (atrium.w >> 1), atrium.z + (atrium.h >> 1));
  const spawn = cellCenter(spawnI, spawnJ);

  return {
    seed,
    size: SIZE,
    cell: CELL,
    walk,
    flooded,
    openSky,
    spawnX: spawn.x,
    spawnZ: spawn.z,
    rooms,
    relics,
    civName,
    civRule,
    landmarkName,
    landmarkKind,
    landmark: { cx: ac.x, cz: ac.z, w: atrium.w * CELL, d: atrium.h * CELL },
    style,
  };
}

export function isWalk(world: RuinWorld, i: number, j: number) {
  if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return false;
  return world.walk[idx(i, j)] === 1;
}
