/*
  管理者頁。権限付与は ID のみ。ゲームループは持たない。
  ビルトイン以外は、ここに並ぶ連携者の ID を渡してもらう。
*/
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getIdentity,
  grantAdmin,
  listLinkedUsers,
  revokeAdmin,
  type LinkedUser,
} from "@/lib/admin";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [people, setPeople] = useState<LinkedUser[]>([]);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => {
    void listLinkedUsers()
      .then(setPeople)
      .catch(() => setPeople([]));
  };

  useEffect(() => {
    if (!user) {
      setAllowed(false);
      return;
    }
    void getIdentity()
      .then((me) => {
        setAllowed(me.isAdmin);
        if (me.isAdmin) reload();
      })
      .catch(() => setAllowed(false));
  }, [user]);

  if (isPending || allowed === null) {
    return (
      <main className="min-h-dvh bg-bg px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-muted text-sm">確認している。</p>
      </main>
    );
  }

  if (!user || !allowed) {
    return (
      <main className="min-h-dvh bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <article className="panel mx-auto w-full max-w-lg p-6">
          <h1 className="font-display text-3xl">管理者</h1>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            この頁は、名を残した管理者だけが踏める。
          </p>
          <Link to="/" className="btn-primary mt-8 flex w-full items-center justify-center">
            入口に戻る
          </Link>
        </article>
      </main>
    );
  }

  const grant = () => {
    const id = draft.trim();
    if (!id || busy) return;
    setBusy(true);
    setNote("");
    void grantAdmin({ data: { userId: id } })
      .then((res) => {
        if (!res.ok) {
          setNote(
            res.reason === "missing"
              ? "その ID の連携者はまだいない。"
              : "付与できなかった。",
          );
          return;
        }
        setDraft("");
        setNote("付与した。");
        reload();
      })
      .catch(() => setNote("付与できなかった。"))
      .finally(() => setBusy(false));
  };

  return (
    <main className="min-h-dvh bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <article className="panel mx-auto w-full max-w-lg p-6 sm:p-8">
        <p className="text-muted mb-2 text-xs tracking-[0.28em]">ECHOES OF COLLAPSE</p>
        <h1 className="font-display text-3xl leading-tight">管理者</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          権限は ID で渡す。メールではない。連携した者が、入口で自分の ID を見せる。
        </p>

        <label className="text-subtle mt-6 mb-1 block text-xs tracking-wider">付与する ID</label>
        <input
          className="seed-input"
          value={draft}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") grant();
          }}
        />
        <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={grant}>
          管理者にする
        </button>
        {note ? <p className="text-muted mt-2 text-sm">{note}</p> : null}

        <h2 className="font-display mt-8 text-lg">連携している名</h2>
        <ol className="mt-3 space-y-3">
          {people.map((p) => (
            <li key={p.userId} className="border-line border-t pt-3">
              <p className="font-display text-sm">
                {p.name || "無名"}
                {p.builtin ? (
                  <span className="text-subtle"> · ビルトイン</span>
                ) : p.isAdmin ? (
                  <span className="text-subtle"> · 管理者</span>
                ) : null}
              </p>
              <p className="text-muted mt-1 font-mono text-xs break-all">{p.userId}</p>
              {!p.builtin && p.isAdmin ? (
                <button
                  type="button"
                  className="text-subtle mt-2 text-xs underline-offset-4 hover:underline"
                  onClick={() => {
                    void revokeAdmin({ data: { userId: p.userId } }).then(reload);
                  }}
                >
                  外す
                </button>
              ) : null}
            </li>
          ))}
        </ol>

        <Link to="/" className="btn-ghost mt-8 flex w-full items-center justify-center">
          入口に戻る
        </Link>
      </article>
    </main>
  );
}
