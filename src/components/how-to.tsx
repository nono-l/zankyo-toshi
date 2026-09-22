/*
  入口の遊び方。表示はトグル。器（パソコン／スマホ）を申告してから操作を出す。
*/
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Monitor, Smartphone } from "lucide-react";

export type PlayDevice = "pc" | "phone";

const HOWTO_KEY = "echoes-howto";
const DEVICE_KEY = "echoes-device";

export function readHowToOn() {
  try {
    return localStorage.getItem(HOWTO_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeHowToOn(on: boolean) {
  try {
    localStorage.setItem(HOWTO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readPlayDevice(): PlayDevice | null {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    if (v === "pc" || v === "phone") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writePlayDevice(device: PlayDevice) {
  try {
    localStorage.setItem(DEVICE_KEY, device);
  } catch {
    /* ignore */
  }
}

export function HowToToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="btn-ghost hit hit-ui inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-4"
      aria-pressed={on}
      onClick={() => onChange(!on)}
    >
      遊び方
      <span className="how-switch" data-on={on ? "true" : "false"} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

export function HowToPanel({
  device,
  onDevice,
}: {
  device: PlayDevice | null;
  onDevice: (next: PlayDevice) => void;
}) {
  return (
    <div className="panel hit title-howto p-5 sm:p-7">
      <p className="text-subtle text-xs tracking-wider">操作</p>
      {!device ? (
        <>
          <h2 className="font-display mt-1 text-xl leading-tight">いまの器は</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            机の上か、掌の上か。申告してから、その環境の手順を出す。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-ghost hit hit-ui inline-flex h-12 items-center justify-center gap-2"
              onClick={() => onDevice("pc")}
            >
              <Monitor className="size-4" />
              パソコン
            </button>
            <button
              type="button"
              className="btn-ghost hit hit-ui inline-flex h-12 items-center justify-center gap-2"
              onClick={() => onDevice("phone")}
            >
              <Smartphone className="size-4" />
              スマホ
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl leading-tight">
              {device === "pc" ? "パソコン" : "スマホ"}
            </h2>
            <button
              type="button"
              className="btn-ghost hit hit-ui h-11 px-3 text-xs"
              onClick={() => onDevice(device === "pc" ? "phone" : "pc")}
            >
              {device === "pc" ? "スマホへ" : "パソコンへ"}
            </button>
          </div>
          {device === "pc" ? <PcTutorial /> : <PhoneTutorial />}
          <Link
            to="/guide"
            className="btn-ghost mt-auto flex h-11 w-full items-center justify-center"
          >
            滅び方の読み方
          </Link>
        </>
      )}
    </div>
  );
}

export function HowToHint({ device }: { device: PlayDevice }) {
  return (
    <p className="text-subtle mt-2 max-w-xs text-xs leading-relaxed">
      {device === "pc"
        ? "WASD 歩く · 画面で視線 · F 灯火 · R 閃光 · Esc 停止"
        : "左の円 歩く · 画面を滑らせる · 炎 灯火 · 穴 閃光"}
    </p>
  );
}

export function useHowToPrefs() {
  const [howTo, setHowTo] = useState(true);
  const [device, setDevice] = useState<PlayDevice | null>(null);

  useEffect(() => {
    setHowTo(readHowToOn());
    setDevice(readPlayDevice());
  }, []);

  return {
    howTo,
    device,
    setHowTo: (next: boolean) => {
      setHowTo(next);
      writeHowToOn(next);
    },
    setDevice: (next: PlayDevice) => {
      setDevice(next);
      writePlayDevice(next);
    },
  };
}

function PcTutorial() {
  return (
    <dl className="how-keys text-muted mt-3 space-y-3 text-sm leading-relaxed">
      <div>
        <dt className="text-fg font-display">歩く</dt>
        <dd className="mt-1">
          <span className="font-mono">W</span> 前、
          <span className="font-mono">S</span> 後、
          <span className="font-mono">A</span> 左、
          <span className="font-mono">D</span> 右。矢印でも同じ。
        </dd>
      </div>
      <div>
        <dt className="text-fg font-display">視線</dt>
        <dd className="mt-1">画面の空いたところをクリックして掴み、滑らせる。</dd>
      </div>
      <div>
        <dt className="text-fg font-display">灯火</dt>
        <dd className="mt-1">
          <span className="font-mono">F</span>、または炎の印。消せばおよそ六メートル、灯せばおよそ二十メートル。
        </dd>
      </div>
      <div>
        <dt className="text-fg font-display">測量の閃光</dt>
        <dd className="mt-1">
          <span className="font-mono">R</span>、または穴の印。六十秒に一度、遠方を一秒だけ返す。
        </dd>
      </div>
      <div>
        <dt className="text-fg font-display">停止</dt>
        <dd className="mt-1">
          <span className="font-mono">Esc</span> または <span className="font-mono">P</span>。
        </dd>
      </div>
    </dl>
  );
}

function PhoneTutorial() {
  return (
    <dl className="how-keys text-muted mt-3 space-y-3 text-sm leading-relaxed">
      <div>
        <dt className="text-fg font-display">歩く</dt>
        <dd className="mt-1">左下の円に指を置く。置いた向きへ進む。</dd>
      </div>
      <div>
        <dt className="text-fg font-display">視線</dt>
        <dd className="mt-1">画面の空いたところを滑らせる。</dd>
      </div>
      <div>
        <dt className="text-fg font-display">灯火</dt>
        <dd className="mt-1">右下の炎の印。消せばおよそ六メートル、灯せばおよそ二十メートル。</dd>
      </div>
      <div>
        <dt className="text-fg font-display">測量の閃光</dt>
        <dd className="mt-1">穴の印。冷却のあいだ、印は秒を数える。</dd>
      </div>
      <div>
        <dt className="text-fg font-display">停止</dt>
        <dd className="mt-1">右上の停止の印。</dd>
      </div>
    </dl>
  );
}
