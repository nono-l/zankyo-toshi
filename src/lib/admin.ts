/*
  管理者判定と権限付与。プロフ名は profile.ts。
  ビルトインは Google の touko5536@gmail.com。コードに固定し、表からは外せない。
  権限付与は ID 指定。メールで付与しない（表示名やメールは変わりうる）。
*/
import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export const BUILTIN_ADMIN_EMAIL = "touko5536@gmail.com";

export type Identity = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  builtin: boolean;
};

export type LinkedUser = {
  userId: string;
  email: string | null;
  name: string;
  isAdmin: boolean;
  builtin: boolean;
};

function clipId(raw: string) {
  return String(raw ?? "").trim().slice(0, 80);
}

function isBuiltinEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === BUILTIN_ADMIN_EMAIL;
}

async function emailOf(sql: Sql, userId: string) {
  const rows = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1
  `;
  return rows[0]?.email ?? null;
}

async function isAdminUser(sql: Sql, userId: string, email: string | null) {
  if (isBuiltinEmail(email)) return true;
  const rows = await sql<{ user_id: string }>`
    select user_id from admins where user_id = ${userId} limit 1
  `;
  return rows.length > 0;
}

export async function userIsAdmin(sql: Sql, userId: string) {
  const email = await emailOf(sql, userId);
  return isAdminUser(sql, userId, email);
}


export const getIdentity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const email = await emailOf(sql, context.userId);
    const builtin = isBuiltinEmail(email);
    const isAdmin = await isAdminUser(sql, context.userId, email);
    return {
      userId: context.userId,
      email,
      isAdmin,
      builtin,
    } satisfies Identity;
  });

export const listLinkedUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const email = await emailOf(sql, context.userId);
    if (!(await isAdminUser(sql, context.userId, email))) {
      return [] as LinkedUser[];
    }
    const rows = await sql<{
      id: string;
      email: string | null;
      name: string;
    }>`
      select id, email, name from "user" order by "createdAt" desc limit 200
    `;
    const granted = await sql<{ user_id: string }>`
      select user_id from admins
    `;
    const grantedSet = new Set(granted.map((g) => g.user_id));
    return rows.map(
      (r): LinkedUser => {
        const builtin = isBuiltinEmail(r.email);
        return {
          userId: r.id,
          email: r.email,
          name: r.name,
          builtin,
          isAdmin: builtin || grantedSet.has(r.id),
        };
      },
    );
  });

export const grantAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: { userId: string }) => ({ userId: clipId(raw?.userId ?? "") }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const email = await emailOf(sql, context.userId);
    if (!(await isAdminUser(sql, context.userId, email))) {
      return { ok: false as const, reason: "not-admin" };
    }
    if (!data.userId) return { ok: false as const, reason: "empty" };
    const target = await sql<{ id: string }>`
      select id from "user" where id = ${data.userId} limit 1
    `;
    if (!target[0]) return { ok: false as const, reason: "missing" };
    await sql`
      insert into admins (user_id, granted_by)
      values (${data.userId}, ${context.userId})
      on conflict (user_id) do nothing
    `;
    return { ok: true as const };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: { userId: string }) => ({ userId: clipId(raw?.userId ?? "") }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const email = await emailOf(sql, context.userId);
    if (!(await isAdminUser(sql, context.userId, email))) {
      return { ok: false as const, reason: "not-admin" };
    }
    if (!data.userId) return { ok: false as const, reason: "empty" };
    const targetEmail = await emailOf(sql, data.userId);
    if (isBuiltinEmail(targetEmail)) return { ok: false as const, reason: "builtin" };
    await sql`delete from admins where user_id = ${data.userId}`;
    return { ok: true as const };
  });
