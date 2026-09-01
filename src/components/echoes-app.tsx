/*
  入口・HUD・離脱。WebGL は EchoesEngine。
  拾得は pending。通常離脱で finds へ、緊急脱出は捨てて escape ログ。
  脱出のたびシードを引き直す。同じ滅びを踏みたい人は名を手で戻す。
*/
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Aperture, BookOpen, Flame, Pause, Play } from "lucide-react";
import { EchoesEngine, type HudState } from "@/game/echoes";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listExploreLogs, recordEmergencyEscape, recordRelicFind, type ExploreLog, type FindInput } from "@/lib/finds";
import { getProfile, updateProfile } from "@/lib/profile";

const DEFAULT_SEED = "残響-7f3a";
const SEED_HEAD = ["残響", "灰", "霧", "沈水", "輪郭", "観測", "基壇", "無音", "塩", "錆", "凍土", "夜半"] as const;

function nextSeed(avoid?: string) {
  let s = "";
  do {
    const head = SEED_HEAD[Math.floor(Math.random() * SEED_HEAD.length)]!;
    const n = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0");
    s = `${head}-${n}`;
  } while (s === avoid);
  return s;
}


function formatFoundAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).format(d);
}

export function EchoesApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EchoesEngine | null>(null);
  const lookPtr = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const userRef = useRef<ReturnType<typeof useCurrentUserState>["user"]>(null);
  const { user, isPending } = useCurrentUserState();
  userRef.current = user;
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [phase, setPhase] = useState<"title" | "play">("title");
  const [journal, setJournal] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [log, setLog] = useState<ExploreLog[] | null>(null);
  const [pending, setPending] = useState<FindInput[]>([]);
  const [confirmEscape, setConfirmEscape] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pendingRef = useRef<FindInput[]>([]);
  pendingRef.current = pending;


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new EchoesEngine(canvas, seed);
    engineRef.current = engine;
    engine.onRelicFound = (info) => {
      // ここでは DB に書かない。緊急脱出で没収できなくなる。
      const row: FindInput = {
        seed: info.seed,
        civName: info.civName,
        landmarkName: info.landmarkName,
        placeLabel: info.atLandmark ? `核 · ${info.landmarkName}` : `廃廊 · ${info.civName}`,
        relicId: info.relic.id,
        relicTitle: info.relic.title,
        worldX: info.x,
        worldZ: info.z,
      };
      pendingRef.current = [...pendingRef.current, row];
      setPending(pendingRef.current);
    };

    const off = engine.subscribe(setHud);
    return () => {
      engine.onRelicFound = null;
      off();
      engine.dispose();
      engineRef.current = null;
    };
    // mount once; seed changes go through regenerate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) {
      setLog(null);
      return;
    }
    void listExploreLogs()
      .then(setLog)
      .catch(() => setLog([]));
  }, [user]);

  const begin = () => {
    const e = engineRef.current;
    if (!e) return;
    const s = seed.trim() || DEFAULT_SEED;
    if (s !== e.world.seed) e.regenerate(s);
    e.startPlay();
    setPhase("play");
    setJournal(false);
    setPending([]);
    pendingRef.current = [];
    setConfirmEscape(false);
  };

  const refreshLog = () => {
    if (!userRef.current) return;
    void listExploreLogs()
      .then(setLog)
      .catch(() => {});
  };

  const leaveToTitle = () => {
    const e = engineRef.current;
    const next = nextSeed(e?.world.seed ?? seed);
    setSeed(next);
    e?.endRun();
    e?.regenerate(next);
    setPhase("title");
    setJournal(false);
    setConfirmEscape(false);
    setPending([]);
    pendingRef.current = [];
    setLeaving(false);
    onStick(0, 0);
  };

  const normalExit = () => {
    if (leaving) return;
    setLeaving(true);
    const rows = pendingRef.current;
    const go = async () => {
      if (userRef.current) {
        for (const row of rows) {
          await recordRelicFind({ data: row }).catch(() => {});
        }
        refreshLog();
      }
      leaveToTitle();
    };
    void go();
  };

  const emergencyExit = () => {
    if (leaving) return;
    setLeaving(true);
    const n = pendingRef.current.length;
    const e = engineRef.current;
    const go = async () => {
      if (userRef.current && e) {
        await recordEmergencyEscape({
          data: {
            seed: e.world.seed,
            civName: e.world.civName,
            landmarkName: e.world.landmarkName,
            confiscated: n,
          },
        }).catch(() => {});
        refreshLog();
      }
      leaveToTitle();
    };
    void go();
  };


  const onStick = (x: number, y: number) => {
    setStick({ x, y });
    engineRef.current?.applyExternalStick(x, y);
  };

  const onLookDown = (ev: React.PointerEvent) => {
    if (phase !== "play" || hud?.paused) return;
    if ((ev.target as HTMLElement).closest(".hit-ui")) return;
    lookPtr.current = ev.pointerId;
    lookLast.current = { x: ev.clientX, y: ev.clientY };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const onLookMove = (ev: React.PointerEvent) => {
    if (document.pointerLockElement) return;
    if (lookPtr.current !== ev.pointerId) return;
    const dx = ev.clientX - lookLast.current.x;
    const dy = ev.clientY - lookLast.current.y;
    lookLast.current = { x: ev.clientX, y: ev.clientY };
    engineRef.current?.applyExternalLook(dx, dy);
  };
  const onLookUp = (ev: React.PointerEvent) => {
    if (lookPtr.current === ev.pointerId) lookPtr.current = null;
  };

  const paused = !!hud?.paused;

  return (
    <div className="game-root">
      <canvas ref={canvasRef} aria-label="廃墟の光景" />

      <div className="hud-layer">
        {phase === "play" && !paused && (
          <div
            className="hit absolute inset-0 z-0"
            onPointerDown={(ev) => {
              onLookDown(ev);
              (ev.currentTarget as HTMLElement).requestPointerLock?.();
            }}
            onPointerMove={onLookMove}
            onPointerUp={onLookUp}
            onPointerCancel={onLookUp}
          />
        )}
        {phase === "title" && (
          <div className="flex h-full flex-col justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
            <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/guide"
                  className="btn-ghost hit hit-ui inline-flex h-11 items-center px-4"
                >
                  遊び方
                </Link>
                <Link
                  to="/terms"
                  className="btn-ghost hit hit-ui inline-flex h-11 items-center px-4"
                >
                  配信規約（ビデオポリシー）
                </Link>
              </div>
              <AuthChip isPending={isPending} user={user} />
            </div>


            <div className="panel hit max-w-lg reveal p-6 sm:p-8">
              <p className="text-muted mb-2 text-xs tracking-[0.28em]">ECHOES OF COLLAPSE</p>
              <h1 className="font-display text-[clamp(2rem,8vw,3.2rem)] leading-tight font-medium tracking-tight">
                残響都市
              </h1>
              <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
                文明の文法が先にあり、廃墟はその劣化結果である。シードごとに滅び方が変わる。
              </p>
              <label className="text-subtle mt-5 mb-1 block text-xs tracking-wider">シード</label>
              <input
                className="seed-input"
                value={seed}
                onChange={(e) => {
                  setSeed(e.target.value);
                  engineRef.current?.regenerate(e.target.value.trim() || DEFAULT_SEED);
                }}
                enterKeyHint="go"
                autoCapitalize="off"
                autoCorrect="off"
              />
              {hud && (
                <p className="text-muted mt-3 text-sm">
                  {hud.civName} / {hud.landmarkName}
                </p>
              )}
              <button type="button" className="btn-primary mt-5 w-full" onClick={begin}>
                踏入する
              </button>
              <p className="text-subtle mt-3 text-xs leading-relaxed">
                {user
                  ? "入口の光に触れて出れば記録が残る。触れずに戻れば緊急脱出となり、拾った断片は没収される。"
                  : "ID連携すると、入口から出た断片が日付と場所とともに残る。"}
              </p>
              <p className="text-subtle mt-2 text-xs leading-relaxed">
                六十秒に一度だけ、測量の閃光が遠方の輪郭を一秒返す。影の長さで時刻を決めた文明の、残った規格だ。
              </p>
            </div>
            <p className="text-subtle mt-3 self-end text-xs tracking-wide">
              電気通信事業者　届出済
            </p>
          </div>
        )}

        {phase === "play" && hud && (
          <>
            <div className="relative z-10 flex items-start justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="panel px-3 py-2">
                <p className="font-display text-sm">{hud.civName}</p>
                <p className="text-muted font-mono text-[11px]">{hud.seed}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost hit hit-ui grid size-11 place-items-center p-0"
                  aria-label="記録"
                  onClick={() => setJournal(true)}
                >
                  <BookOpen className="size-4" />
                </button>
                <button
                  type="button"
                  className="btn-ghost hit hit-ui grid size-11 place-items-center p-0"
                  aria-label="一時停止"
                  onClick={() => engineRef.current?.setPaused(true)}
                >
                  <Pause className="size-4" />
                </button>
              </div>
            </div>

            <div className="relative z-10 mt-3 px-4">
              <p className="text-muted text-xs tracking-wide">
                断片 {hud.found}/{hud.total}
                {hud.atLandmark ? " · 核に到達" : ` · ${hud.landmarkName}`}
              </p>
              {hud.toast && (
                <p className="font-display mt-2 max-w-xs text-sm leading-snug">{hud.toast}</p>
              )}
              {hud.atPortal && (
                <button
                  type="button"
                  className="btn-primary hit hit-ui mt-3"
                  disabled={leaving}
                  onClick={normalExit}
                >
                  通常離脱
                </button>
              )}
            </div>

            <div className="relative z-10 mt-auto flex items-end justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <Joystick x={stick.x} y={stick.y} onChange={onStick} />
              <div className="mb-3 flex flex-col items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost hit hit-ui grid size-14 place-items-center rounded-full p-0"
                  aria-label="測量閃"
                  disabled={hud.flashCd > 0 || hud.flashing}
                  onClick={() => engineRef.current?.triggerFlash()}
                >
                  {hud.flashCd > 0 && !hud.flashing ? (
                    <span className="font-mono text-xs">{hud.flashCd}</span>
                  ) : (
                    <Aperture className={`size-5 ${hud.flashing ? "text-fg" : "text-subtle"}`} />
                  )}
                </button>
                <button
                  type="button"
                  className="btn-ghost hit hit-ui grid size-14 place-items-center rounded-full p-0"
                  aria-label="灯火"
                  aria-pressed={hud.lantern}
                  onClick={() => engineRef.current?.toggleLantern()}
                >
                  <Flame className={`size-5 ${hud.lantern ? "text-fg" : "text-subtle"}`} />
                </button>
              </div>
            </div>

          </>
        )}
      </div>

      {paused && hud && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-[color-mix(in_oklab,var(--color-bg)_55%,transparent)] px-5 pb-10">
          <div className="panel hit w-full max-w-md p-6">
            {confirmEscape ? (
              <>
                <h2 className="font-display text-2xl">緊急脱出</h2>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  入口の光に触れていない。ここで出ると、この廃墟で拾った
                  {pending.length}個の断片は没収され、緊急脱出として記録される。
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={leaving}
                    onClick={emergencyExit}
                  >
                    緊急脱出する
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setConfirmEscape(false)}
                  >
                    戻る
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl">停止</h2>
                <p className="text-muted mt-2 text-sm leading-relaxed">{hud.civRule}</p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center justify-center gap-2"
                    onClick={() => engineRef.current?.setPaused(false)}
                  >
                    <Play className="size-4" />
                    再開
                  </button>
                  {hud.atPortal ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={leaving}
                      onClick={normalExit}
                    >
                      入口から出る
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setConfirmEscape(true)}
                    >
                      緊急脱出
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {journal && hud && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-[color-mix(in_oklab,var(--color-bg)_55%,transparent)] px-5 pb-10">
          <div className="panel hit max-h-[80dvh] w-full max-w-md overflow-auto p-6">
            <h2 className="font-display text-2xl">記録</h2>
            <p className="text-muted mt-1 text-sm">{hud.civRule}</p>
            <ol className="mt-4 space-y-3">
              {engineRef.current?.world.relics.map((r) => {
                const known = hud.foundIds.includes(r.id);
                return (
                  <li key={r.id} className="border-line border-t pt-3">
                    <p className="font-display text-sm">{known ? r.title : "未読の断片"}</p>
                    {known && <p className="text-muted mt-1 text-sm leading-relaxed">{r.body}</p>}
                  </li>
                );
              })}
            </ol>
            {hud.complete && (
              <p className="mt-4 text-sm">この滅び方を読んだ。別のシードは、別の死に方だ。</p>
            )}

            <h3 className="font-display mt-6 text-lg">探索実績</h3>
            {!user ? (
              <p className="text-muted mt-2 text-sm leading-relaxed">
                ID連携すると、何月何日の何時に、どこで、どの断片を拾ったかが残る。入口以外からの離脱は緊急脱出として記録される。
              </p>
            ) : log && log.length === 0 ? (
              <p className="text-muted mt-2 text-sm">まだ記録はない。</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {(log ?? []).map((row) => (
                  <li key={row.id} className="border-line border-t pt-3">
                    <p className="text-subtle text-xs tracking-wide">{formatFoundAt(row.at)}</p>
                    <p className="font-display mt-1 text-sm">{row.title}</p>
                    <p className="text-muted mt-1 text-sm leading-relaxed">
                      {row.placeLabel}
                      <span className="text-subtle"> · {row.civName}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}

            <button type="button" className="btn-primary mt-5 w-full" onClick={() => setJournal(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthChip({
  isPending,
  user,
}: {
  isPending: boolean;
  user: ReturnType<typeof useCurrentUserState>["user"];
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setName(null);
      setEditing(false);
      return;
    }
    void getProfile()
      .then((p) => setName(p.displayName || user.displayName || ""))
      .catch(() => setName(user.displayName || ""));
  }, [user]);

  if (isPending) {
    return <div className="btn-ghost h-11 w-24 animate-pulse" aria-hidden="true" />;
  }
  if (!user) {
    return (
      <Link to="/login" className="btn-ghost hit hit-ui inline-flex items-center justify-center px-4">
        ID連携
      </Link>
    );
  }

  const label = name || user.displayName || user.primaryEmail || "連携中";

  const save = () => {
    const next = draft.replace(/\s+/g, " ").trim().slice(0, 24);
    if (!next || saving) return;
    setSaving(true);
    void updateProfile({ data: { displayName: next } })
      .then((res) => {
        if (res.ok) setName(res.displayName);
        setEditing(false);
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (editing) {
    return (
      <div className="panel hit w-[min(100%,18rem)] p-3">
        <label className="text-subtle mb-1 block text-xs tracking-wider">プロフ名</label>
        <input
          className="seed-input"
          value={draft}
          maxLength={24}
          autoComplete="nickname"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primary flex-1" disabled={saving} onClick={save}>
            {saving ? "保存中" : "保存"}
          </button>
          <button type="button" className="btn-ghost flex-1" onClick={() => setEditing(false)}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel hit flex items-center gap-2 px-3 py-2">
      <span className="max-w-[8rem] truncate text-sm">{label}</span>
      <button
        type="button"
        className="text-subtle text-xs underline-offset-4 hover:underline"
        onClick={() => {
          setDraft(label === "連携中" ? "" : label);
          setEditing(true);
        }}
      >
        変更
      </button>
      <button
        type="button"
        className="text-subtle text-xs underline-offset-4 hover:underline disabled:opacity-50"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void signOut().catch(() => setSigningOut(false));
        }}
      >
        {signingOut ? "解除中" : "解除"}
      </button>
    </div>
  );
}


function Joystick({
  x,
  y,
  onChange,
}: {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}) {
  const base = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);

  const read = (ev: React.PointerEvent) => {
    const el = base.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const max = b.width * 0.42;
    let dx = ev.clientX - cx;
    let dy = ev.clientY - cy;
    const m = Math.hypot(dx, dy);
    if (m > max) {
      dx = (dx / m) * max;
      dy = (dy / m) * max;
    }
    onChange(dx / max, dy / max);
  };

  return (
    <div
      ref={base}
      className="stick-base hit hit-ui"
      onPointerDown={(e) => {
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        read(e);
      }}
      onPointerMove={(e) => {
        if (pid.current === e.pointerId) read(e);
      }}
      onPointerUp={() => {
        pid.current = null;
        onChange(0, 0);
      }}
      onPointerCancel={() => {
        pid.current = null;
        onChange(0, 0);
      }}
    >
      <div
        className="stick-knob"
        style={{
          transform: `translate(calc(-50% + ${x * 28}px), calc(-50% + ${y * 28}px))`,
        }}
      />
    </div>
  );
}
