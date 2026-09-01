/*
  連携後の表示名。Better Auth の user.name は OAuth 再ログインで上書きされるので別表。
*/
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type Profile = {
  displayName: string;
};

function clipName(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 24);
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const name = rows[0]?.display_name?.trim() ?? "";
    return { displayName: name } satisfies Profile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: { displayName: string }) => ({
    displayName: clipName(String(raw?.displayName ?? "")),
  }))
  .handler(async ({ context, data }) => {
    if (!data.displayName) return { ok: false as const, displayName: "" };
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, display_name, updated_at)
      values (${context.userId}, ${data.displayName}, now())
      on conflict (user_id) do update set
        display_name = excluded.display_name,
        updated_at = now()
    `;
    return { ok: true as const, displayName: data.displayName };
  });
