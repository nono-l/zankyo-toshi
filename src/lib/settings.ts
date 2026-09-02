/*
  全プレイヤー共通の見た目。部屋の明るさ・灯火の強さ・霧の距離。
  読むのは誰でも。書くのは管理者だけ。
*/
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { userIsAdmin } from "@/lib/admin";

export const DEFAULT_LIGHT = { room: 0.28, lantern: 0.48, fogOff: 6.2, fogOn: 20.5 };

export type LightSettings = {
  room: number;
  lantern: number;
  fogOff: number;
  fogOn: number;
};

function clipBright(raw: unknown, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(0, Math.round(n * 100) / 100));
}


function clipM(raw: unknown, min: number, max: number, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n * 2) / 2));
}

export const getLightSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{
    room_bright: number | null;
    lantern_bright: number | null;
    lantern_off_m: number | null;
    lantern_on_m: number | null;
  }>`
    select room_bright, lantern_bright, lantern_off_m, lantern_on_m
    from game_settings where id = 1 limit 1
  `;
  const row = rows[0];
  if (!row) return { ...DEFAULT_LIGHT } satisfies LightSettings;
  return {
    room: clipBright(row.room_bright, DEFAULT_LIGHT.room),
    lantern: clipBright(row.lantern_bright, DEFAULT_LIGHT.lantern),
    fogOff: clipM(row.lantern_off_m, 1, 25, DEFAULT_LIGHT.fogOff),
    fogOn: clipM(row.lantern_on_m, 4, 80, DEFAULT_LIGHT.fogOn),
  } satisfies LightSettings;
});

export const saveLightSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: LightSettings) => ({
    room: clipBright(raw?.room, DEFAULT_LIGHT.room),
    lantern: clipBright(raw?.lantern, DEFAULT_LIGHT.lantern),
    fogOff: clipM(raw?.fogOff, 1, 25, DEFAULT_LIGHT.fogOff),
    fogOn: clipM(raw?.fogOn, 4, 80, DEFAULT_LIGHT.fogOn),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!(await userIsAdmin(sql, context.userId))) {
      return { ok: false as const, reason: "not-admin" };
    }
    await sql`
      insert into game_settings (
        id, lantern_off_m, lantern_on_m, room_bright, lantern_bright, updated_at, updated_by
      )
      values (1, ${data.fogOff}, ${data.fogOn}, ${data.room}, ${data.lantern}, now(), ${context.userId})
      on conflict (id) do update set
        lantern_off_m = excluded.lantern_off_m,
        lantern_on_m = excluded.lantern_on_m,
        room_bright = excluded.room_bright,
        lantern_bright = excluded.lantern_bright,
        updated_at = now(),
        updated_by = excluded.updated_by
    `;
    return { ok: true as const, ...data };
  });
