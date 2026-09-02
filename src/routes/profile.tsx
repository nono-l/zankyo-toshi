/*
  名と ID。入口の狭いチップでは書けないので頁にした。
  ゲームループは持たない。権限付与は /admin。
*/
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getIdentity } from "@/lib/admin";
import { getProfile, updateProfile } from "@/lib/profile";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) {
      setName("");
      setDraft("");
      setIsAdmin(false);
      return;
    }
    void getProfile()
      .then((p) => {
        const n = p.displayName || user.displayName || "";
        setName(n);
        setDraft(n);
      })
      .catch(() => {
        const n = user.displayName || "";
        setName(n);
        setDraft(n);
      });
    void getIdentity()
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user]);

  const save = () => {
    const next = draft.replace(/\s+/g, " ").trim().slice(0, 24);
    if (!next || saving) return;
    setSaving(true);
    setNote("");
    void updateProfile({ data: { displayName: next } })
      .then((res) => {
        if (!res.ok) {
          setNote("残らなかった。");
          return;
        }
        setName(res.displayName);
        setDraft(res.displayName);
        setNote("残した。");
      })
      .catch(() => setNote("残らなかった。"))
      .finally(() => setSaving(false));
  };

  if (isPending) {
    return (
      <main className="min-h-dvh bg-bg px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-muted text-sm">確認している。</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-dvh bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <article className="panel mx-auto w-full max-w-lg p-6">
          <h1 className="font-display text-3xl">名</h1>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            名を残すには、先に ID 連携が要る。
          </p>
          <Link to="/login" className="btn-primary mt-8 flex w-full items-center justify-center">
            ID連携
          </Link>
          <Link to="/" className="btn-ghost mt-2 flex w-full items-center justify-center">
            入口に戻る
          </Link>
        </article>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <article className="panel mx-auto w-full max-w-lg p-6 sm:p-8">
        <p className="text-muted mb-2 text-xs tracking-[0.28em]">ECHOES OF COLLAPSE</p>
        <h1 className="font-display text-3xl leading-tight">名</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          入口の隅では書けない。ここで変える。二十四字まで。
        </p>

        <label className="text-subtle mt-6 mb-1 block text-xs tracking-wider">プロフ名</label>
        <input
          className="seed-input"
          value={draft}
          maxLength={24}
          autoComplete="nickname"
          autoCapitalize="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <button type="button" className="btn-primary mt-3 w-full" disabled={saving} onClick={save}>
          {saving ? "保存中" : "保存"}
        </button>
        {note ? <p className="text-muted mt-2 text-sm">{note}</p> : null}

        <label className="text-subtle mt-6 mb-1 block text-xs tracking-wider">ID</label>
        <input
          className="seed-input font-mono"
          readOnly
          value={user.id}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="btn-ghost mt-2 w-full"
          onClick={() => {
            void navigator.clipboard.writeText(user.id).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              },
              () => {},
            );
          }}
        >
          {copied ? "写した" : "IDを写す"}
        </button>
        <p className="text-subtle mt-2 text-xs leading-relaxed">
          管理者へ渡すための印。メールではない。
        </p>

        {isAdmin ? (
          <Link to="/admin" className="btn-ghost mt-6 flex w-full items-center justify-center">
            管理者
          </Link>
        ) : null}

        <button
          type="button"
          className="btn-ghost mt-2 w-full disabled:opacity-50"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut()
              .then(() => {
                window.location.href = "/";
              })
              .catch(() => setSigningOut(false));
          }}
        >
          {signingOut ? "解除中" : "連携を解除"}
        </button>

        <Link to="/" className="btn-primary mt-6 flex w-full items-center justify-center">
          入口に戻る
        </Link>
        {name && name !== draft ? (
          <p className="text-subtle mt-3 text-xs">いま残っている名は {name}。</p>
        ) : null}
      </article>
    </main>
  );
}
