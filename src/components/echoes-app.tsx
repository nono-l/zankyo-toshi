/*
  入口・HUD・離脱。WebGL は EchoesEngine。
  拾得は pending。通常離脱で finds へ、緊急脱出は捨てて escape ログ。
  脱出のたびシードを引き直す。同じ滅びを踏みたい人は名を手で戻す。
*/
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Aperture, BookOpen, Flame, Pause, Play, SlidersHorizontal } from "lucide-react";
import { EchoesEngine, type HudState } from "@/game/echoes";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listExploreLogs, recordEmergencyEscape, recordRelicFind, type ExploreLog, type FindInput } from "@/lib/finds";
import { getIdentity } from "@/lib/admin";
import { getProfile } from "@/lib/profile";
import { getLightSettings, saveLightSettings } from "@/lib/settings";
import { GhostGallery } from "@/components/ghost-gallery";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTools, setAdminTools] = useState(false);
  const [savingLight, setSavingLight] = useState(false);
  const [lightNote, setLightNote] = useState("");
  const [lightPreview, setLightPreview] = useState<
    "room" | "lantern" | "fogOff" | "fogOn" | null
  >(null);
  const [ghostFarewell, setGhostFarewell] = useState<"kasa" | "mimic" | "aka" | null>(null);
  const [ghostGallery, setGhostGallery] = useState(false);
  const pendingRef = useRef<FindInput[]>([]);
  pendingRef.current = pending;
  const emergencyExitRef = useRef<(reason?: "emergency" | "ghost" | "mimic") => void>(() => {});



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
    engine.onGhostHit = (kind) => {
      engine.setPaused(true);
      setGhostFarewell(kind);
      window.setTimeout(() => emergencyExitRef.current(kind === "mimic" ? "mimic" : "ghost"), 3400);
    };


    const off = engine.subscribe(setHud);
    void getLightSettings()
      .then((s) => engine.setLook({ room: s.room, lantern: s.lantern, fogOff: s.fogOff, fogOn: s.fogOn }))
      .catch(() => {});
    return () => {
      engine.onRelicFound = null;
      engine.onGhostHit = null;
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
      setIsAdmin(false);
      setAdminTools(false);
      return;
    }
    void listExploreLogs()
      .then(setLog)
      .catch(() => setLog([]));
    void getIdentity()
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => setIsAdmin(false));
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
    setGhostFarewell(null);
    setGhostGallery(false);
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

  const emergencyExit = (reason: "emergency" | "ghost" | "mimic" = "emergency") => {
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
            reason,
          },
        }).catch(() => {});
        refreshLog();
      }
      leaveToTitle();
    };
    void go();
  };
  emergencyExitRef.current = emergencyExit;

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
            <div className="relative z-10 mb-4 flex flex-col gap-2">
              <div className="flex justify-end">
                <AuthChip isPending={isPending} user={user} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/guide"
                  className="btn-ghost hit hit-ui inline-flex h-11 shrink-0 items-center whitespace-nowrap px-4"
                >
                  遊び方
                </Link>
                <Link
                  to="/terms"
                  className="btn-ghost hit hit-ui inline-flex h-11 shrink-0 items-center whitespace-nowrap px-4"
                >
                  配信規約（ビデオポリシー）
                </Link>
              </div>
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

        {phase === "play" && hud && !lightPreview && !ghostFarewell && (
          <>
            <div className="relative z-10 flex items-start justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="panel px-3 py-2">
                <p className="font-display text-sm">{hud.civName}</p>
                <p className="text-muted font-mono text-[11px]">{hud.seed}</p>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-ghost hit hit-ui grid size-11 place-items-center p-0"
                    aria-label="管理"
                    onClick={() => {
                      engineRef.current?.setPaused(true);
                      setAdminTools(true);
                    }}
                  >
                    <SlidersHorizontal className="size-4" />
                  </button>
                )}
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
              {hud.debug.showPos && (
                <p className="text-subtle mt-2 font-mono text-xs">
                  {hud.posX.toFixed(1)}, {hud.posZ.toFixed(1)}
                  {hud.debug.speed > 1 ? ` · ${hud.debug.speed}倍` : ""}
                </p>
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

      {ghostFarewell && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-[color-mix(in_oklab,var(--color-bg)_62%,transparent)] px-5 pb-16">
          <div className="panel w-full max-w-md p-6">
            {ghostFarewell === "mimic" ? (
              <>
                <p className="font-display text-xl leading-relaxed">つ〜かま〜えた...</p>
                <p className="text-muted mt-4 text-sm leading-relaxed">ハッピーエンド</p>
              </>
            ) : ghostFarewell === "aka" ? (
              <>
                <p className="font-display text-xl leading-relaxed">アカミソに触れ続けた。</p>
                <p className="text-muted mt-4 text-sm leading-relaxed">この器は、もうダメです。</p>
                <p className="text-muted mt-2 text-sm leading-relaxed">緊急脱出します。</p>
              </>
            ) : (
              <>
                <p className="font-display text-xl leading-relaxed">
                  傘おばけと仲良しになってしまった。
                </p>
                <p className="text-muted mt-4 text-sm leading-relaxed">この器は、もうダメです。</p>
                <p className="text-muted mt-2 text-sm leading-relaxed">緊急脱出します。</p>
              </>
            )}
          </div>
        </div>
      )}

      {paused && hud && !lightPreview && !ghostFarewell && (
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
                    onClick={() => emergencyExit()}
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
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-ghost inline-flex items-center justify-center gap-2"
                      onClick={() => setAdminTools(true)}
                    >
                      <SlidersHorizontal className="size-4" />
                      管理
                    </button>
                  )}
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

      {adminTools && isAdmin && hud && !ghostGallery && (
        <div
          className={`absolute inset-0 z-20 flex items-end justify-center px-5 pb-10 ${
            lightPreview
              ? "bg-transparent"
              : "bg-[color-mix(in_oklab,var(--color-bg)_55%,transparent)]"
          }`}
        >
          {lightPreview && (
            <p className="font-display pointer-events-none absolute top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 z-30 -translate-x-1/2 text-sm tracking-wide">
              {lightPreview === "room"
                ? `部屋 ${Math.round(hud.roomBright * 100)}`
                : lightPreview === "lantern"
                  ? `灯火 ${Math.round(hud.lanternBright * 100)}`
                  : lightPreview === "fogOff"
                    ? `霧（消灯） ${hud.fogOffM.toFixed(1)} m`
                    : `霧（点灯） ${hud.fogOnM.toFixed(1)} m`}
            </p>
          )}
          <div
            className={`panel hit max-h-[80dvh] w-full max-w-md overflow-auto p-6 ${
              lightPreview ? "opacity-0" : ""
            }`}
          >
            <h2 className="font-display text-2xl">管理</h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              デバッグ用。記録には残らない。権限の付与は入口の管理者頁。
            </p>

            <p className="text-subtle mt-5 mb-2 text-xs tracking-wider">歩行速度</p>
            <div className="flex flex-wrap gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={hud.debug.speed === n ? "btn-primary px-4" : "btn-ghost px-4"}
                  aria-pressed={hud.debug.speed === n}
                  onClick={() => engineRef.current?.setDebug({ speed: n })}
                >
                  {n}倍
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={hud.debug.seeAll ? "btn-primary" : "btn-ghost"}
                aria-pressed={hud.debug.seeAll}
                onClick={() => engineRef.current?.setDebug({ seeAll: !hud.debug.seeAll })}
              >
                何処までも見通す
              </button>
              <button
                type="button"
                className={hud.debug.flashInstant ? "btn-primary" : "btn-ghost"}
                aria-pressed={hud.debug.flashInstant}
                onClick={() => engineRef.current?.setDebug({ flashInstant: !hud.debug.flashInstant })}
              >
                測量閃の冷却なし
              </button>
              <button
                type="button"
                className={hud.debug.noclip ? "btn-primary" : "btn-ghost"}
                aria-pressed={hud.debug.noclip}
                onClick={() => engineRef.current?.setDebug({ noclip: !hud.debug.noclip })}
              >
                壁を通る
              </button>
              <button
                type="button"
                className={hud.debug.freeExit ? "btn-primary" : "btn-ghost"}
                aria-pressed={hud.debug.freeExit}
                onClick={() => engineRef.current?.setDebug({ freeExit: !hud.debug.freeExit })}
              >
                どこからでも通常離脱
              </button>
              <button
                type="button"
                className={hud.debug.showPos ? "btn-primary" : "btn-ghost"}
                aria-pressed={hud.debug.showPos}
                onClick={() => engineRef.current?.setDebug({ showPos: !hud.debug.showPos })}
              >
                座標を出す
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => engineRef.current?.teleportTo("portal")}
              >
                入口へ移動
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => engineRef.current?.teleportTo("landmark")}
              >
                核へ移動
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => engineRef.current?.markAllRelicsRead()}
              >
                断片をすべて既読
              </button>
              <Link to="/admin" className="btn-ghost flex items-center justify-center">
                権限の付与
              </Link>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setGhostGallery(true)}
              >
                おばけギャラリー
              </button>
            </div>

            <h3 className="font-display mt-8 text-lg">ゲーム設定</h3>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              部屋の環境光、灯火の強さ、霧が切れる距離。保存すると全員が同じ規格になる。
            </p>
            <label className="text-subtle mt-4 mb-1 block text-xs tracking-wider">
              部屋の明るさ {Math.round(hud.roomBright * 100)}
            </label>
            <input
              className="light-slider hit"
              type="range"
              min={0}
              max={500}
              step={1}
              value={Math.round(hud.roomBright * 100)}
              aria-label="部屋の明るさ"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setLightPreview("room");
                engineRef.current?.setLook({}, "room");
              }}
              onPointerUp={() => setLightPreview(null)}
              onPointerCancel={() => setLightPreview(null)}
              onLostPointerCapture={() => setLightPreview(null)}
              onInput={(e) =>
                engineRef.current?.setLook({ room: Number(e.currentTarget.value) / 100 }, "room")
              }
              onChange={(e) =>
                engineRef.current?.setLook({ room: Number(e.currentTarget.value) / 100 }, "room")
              }
            />
            <label className="text-subtle mt-4 mb-1 block text-xs tracking-wider">
              灯火の明るさ {Math.round(hud.lanternBright * 100)}
            </label>
            <input
              className="light-slider hit"
              type="range"
              min={0}
              max={500}
              step={1}
              value={Math.round(hud.lanternBright * 100)}
              aria-label="灯火の明るさ"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setLightPreview("lantern");
                engineRef.current?.setLook({}, "lantern");
              }}
              onPointerUp={() => setLightPreview(null)}
              onPointerCancel={() => setLightPreview(null)}
              onLostPointerCapture={() => setLightPreview(null)}
              onInput={(e) =>
                engineRef.current?.setLook(
                  { lantern: Number(e.currentTarget.value) / 100 },
                  "lantern",
                )
              }
              onChange={(e) =>
                engineRef.current?.setLook(
                  { lantern: Number(e.currentTarget.value) / 100 },
                  "lantern",
                )
              }
            />
            <label className="text-subtle mt-4 mb-1 block text-xs tracking-wider">
              霧（消灯） {hud.fogOffM.toFixed(1)} m
            </label>
            <input
              className="light-slider hit"
              type="range"
              min={1}
              max={25}
              step={0.5}
              value={hud.fogOffM}
              aria-label="霧の距離（消灯）"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setLightPreview("fogOff");
                engineRef.current?.setLook({}, "fogOff");
              }}
              onPointerUp={() => setLightPreview(null)}
              onPointerCancel={() => setLightPreview(null)}
              onLostPointerCapture={() => setLightPreview(null)}
              onInput={(e) =>
                engineRef.current?.setLook({ fogOff: Number(e.currentTarget.value) }, "fogOff")
              }
              onChange={(e) =>
                engineRef.current?.setLook({ fogOff: Number(e.currentTarget.value) }, "fogOff")
              }
            />
            <label className="text-subtle mt-4 mb-1 block text-xs tracking-wider">
              霧（点灯） {hud.fogOnM.toFixed(1)} m
            </label>
            <input
              className="light-slider hit"
              type="range"
              min={4}
              max={80}
              step={0.5}
              value={hud.fogOnM}
              aria-label="霧の距離（点灯）"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setLightPreview("fogOn");
                engineRef.current?.setLook({}, "fogOn");
              }}
              onPointerUp={() => setLightPreview(null)}
              onPointerCancel={() => setLightPreview(null)}
              onLostPointerCapture={() => setLightPreview(null)}
              onInput={(e) =>
                engineRef.current?.setLook({ fogOn: Number(e.currentTarget.value) }, "fogOn")
              }
              onChange={(e) =>
                engineRef.current?.setLook({ fogOn: Number(e.currentTarget.value) }, "fogOn")
              }
            />
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={savingLight}
              onClick={() => {
                setSavingLight(true);
                setLightNote("");
                void saveLightSettings({
                  data: {
                    room: hud.roomBright,
                    lantern: hud.lanternBright,
                    fogOff: hud.fogOffM,
                    fogOn: hud.fogOnM,
                  },
                })
                  .then((res) => {
                    setLightNote(res.ok ? "全員の規格として残した。" : "保存できなかった。");
                  })
                  .catch(() => setLightNote("保存できなかった。"))
                  .finally(() => setSavingLight(false));
              }}
            >
              {savingLight ? "保存中" : "設定を保存"}
            </button>
            {lightNote ? <p className="text-muted mt-2 text-sm">{lightNote}</p> : null}

            <button
              type="button"
              className="btn-primary mt-5 w-full"
              onClick={() => {
                setAdminTools(false);
                setGhostGallery(false);
                engineRef.current?.setPaused(false);
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {ghostGallery && isAdmin && (
        <GhostGallery
          onClose={() => setGhostGallery(false)}
        />
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
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setName(null);
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

  return (
    <Link
      to="/profile"
      className="panel hit hit-ui inline-flex max-w-[14rem] items-center px-4 py-2"
    >
      <span className="truncate text-sm">{label}</span>
    </Link>
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
