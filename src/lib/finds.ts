/*
  拾得の確定と緊急脱出ログ。プロフ名は profile.ts。
  探索中は INSERT しない。通常離脱で commit、緊急脱出は没収して escape_logs だけ。
  unique (user_id, seed, relic_id) があるので、途中書きすると前回の成功拾得まで消えてしまう。
*/
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type RelicFind = {
  id: number;
  foundAt: string;
  seed: string;
  civName: string;
  landmarkName: string;
  placeLabel: string;
  relicId: number;
  relicTitle: string;
  worldX: number;
  worldZ: number;
};

export type ExploreLog = {
  id: string;
  at: string;
  kind: "find" | "escape" | "ghost";
  seed: string;
  civName: string;
  landmarkName: string;
  placeLabel: string;
  title: string;
};


export type FindInput = {
  seed: string;
  civName: string;
  landmarkName: string;
  placeLabel: string;
  relicId: number;
  relicTitle: string;
  worldX: number;
  worldZ: number;
};

function clip(s: string, n: number) {
  return s.trim().slice(0, n);
}

function asIso(v: string | Date) {
  return typeof v === "string" ? v : new Date(v).toISOString();
}

function parseFind(raw: FindInput): FindInput {
  return {
    seed: clip(String(raw?.seed ?? ""), 80),
    civName: clip(String(raw?.civName ?? ""), 80),
    landmarkName: clip(String(raw?.landmarkName ?? ""), 80),
    placeLabel: clip(String(raw?.placeLabel ?? ""), 80),
    relicId: Math.max(0, Math.min(20, Number(raw?.relicId) || 0)),
    relicTitle: clip(String(raw?.relicTitle ?? ""), 80),
    worldX: Number(raw?.worldX) || 0,
    worldZ: Number(raw?.worldZ) || 0,
  };
}

export const recordRelicFind = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseFind)
  .handler(async ({ context, data }) => {
    if (!data.seed || !data.relicTitle) return { ok: false as const };
    const sql = await getSql();
    await sql`
      insert into relic_finds (
        user_id, seed, civ_name, landmark_name, place_label,
        relic_id, relic_title, world_x, world_z
      ) values (
        ${context.userId}, ${data.seed}, ${data.civName}, ${data.landmarkName},
        ${data.placeLabel}, ${data.relicId}, ${data.relicTitle},
        ${data.worldX}, ${data.worldZ}
      )
      on conflict (user_id, seed, relic_id) do nothing
    `;
    return { ok: true as const };
  });

export const recordEmergencyEscape = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: {
    seed: string;
    civName: string;
    landmarkName: string;
    confiscated: number;
    reason?: string;
  }) => ({
    seed: clip(String(raw?.seed ?? ""), 80),
    civName: clip(String(raw?.civName ?? ""), 80),
    landmarkName: clip(String(raw?.landmarkName ?? ""), 80),
    confiscated: Math.max(0, Math.min(20, Number(raw?.confiscated) || 0)),
    reason: raw?.reason === "ghost" ? "ghost" : "emergency",
  }))
  .handler(async ({ context, data }) => {
    if (!data.seed) return { ok: false as const };
    const sql = await getSql();
    const n = data.confiscated;
    const place =
      data.reason === "ghost"
        ? n > 0
          ? `器の棄却 · ${n}個没収`
          : "器の棄却"

        : n > 0
          ? `${n}個の断片を没収`
          : "拾得なし";
    await sql`
      insert into escape_logs (
        user_id, seed, civ_name, landmark_name, place_label, confiscated, reason
      ) values (
        ${context.userId}, ${data.seed}, ${data.civName}, ${data.landmarkName},
        ${place}, ${n}, ${data.reason}
      )
    `;
    return { ok: true as const };
  });


export const listExploreLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const finds = await sql<{
      id: number;
      found_at: string | Date;
      seed: string;
      civ_name: string;
      landmark_name: string;
      place_label: string;
      relic_title: string;
    }>`
      select id, found_at, seed, civ_name, landmark_name, place_label, relic_title
      from relic_finds
      where user_id = ${context.userId}
      order by found_at desc
      limit 80
    `;
    const escapes = await sql<{
      id: number;
      escaped_at: string | Date;
      seed: string;
      civ_name: string;
      landmark_name: string;
      place_label: string;
      confiscated: number;
      reason: string | null;
    }>`
      select id, escaped_at, seed, civ_name, landmark_name, place_label, confiscated, reason
      from escape_logs
      where user_id = ${context.userId}
      order by escaped_at desc
      limit 80
    `;
    const rows: ExploreLog[] = [
      ...finds.map(
        (r): ExploreLog => ({
          id: `f-${r.id}`,
          at: asIso(r.found_at),
          kind: "find",
          seed: r.seed,
          civName: r.civ_name,
          landmarkName: r.landmark_name,
          placeLabel: r.place_label,
          title: r.relic_title,
        }),
      ),
      ...escapes.map((r): ExploreLog => {
        const ghost = r.reason === "ghost";
        return {
          id: `e-${r.id}`,
          at: asIso(r.escaped_at),
          kind: ghost ? "ghost" : "escape",
          seed: r.seed,
          civName: r.civ_name,
          landmarkName: r.landmark_name,
          placeLabel: r.place_label,
          title: ghost ? "器の棄却" : "緊急脱出",
        };
      }),
    ];

    rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return rows.slice(0, 100);
  });
