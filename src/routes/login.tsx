import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="flex min-h-dvh flex-col justify-end bg-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="panel mx-auto w-full max-w-md p-6 sm:p-8">
        <p className="text-muted mb-2 text-xs tracking-[0.28em]">ID</p>
        <h1 className="font-display text-3xl leading-tight">連携する</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          拾った断片を、日付・時刻・場所とともに記録する。同じシードを踏んでも、あなたの探索は残る。
        </p>
        {authEnabled ? (
          <div className="mt-6 flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className="btn-primary w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                {p.label} で続ける
              </button>
            ))}
          </div>
        ) : (
          <p className="text-subtle mt-6 text-sm">いまは連携できません。</p>
        )}
        <Link to="/" className="btn-ghost mt-3 flex w-full items-center justify-center">
          入口に戻る
        </Link>
      </div>
    </main>
  );
}
