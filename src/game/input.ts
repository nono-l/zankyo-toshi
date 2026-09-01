/*
  入力のサンプリングだけ。歩行や HUD は持たない。
  F 灯火 / R 閃光。edge は sample で消費する。押しっぱなしで連射しないため。
*/
export type Actions = {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  lantern: boolean;
  flash: boolean;
  pause: boolean;
};


function radialDeadzone(x: number, y: number, dz = 0.15) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

export class Input {
  keys = new Set<string>();
  injected = new Set<string>();
  stick = { x: 0, y: 0 };
  lookAcc = { x: 0, y: 0 };
  lanternEdge = false;
  flashEdge = false;
  pauseEdge = false;
  private prevLantern = false;
  private prevFlash = false;
  private prevPause = false;


  attach() {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
      if (e.code === "KeyF") this.lanternEdge = true;
      if (e.code === "KeyR") this.flashEdge = true;
      if (e.code === "Escape" || e.code === "KeyP") this.pauseEdge = true;
    };
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const clear = () => this.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.keys.clear();
    });
    this._detach = () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }

  _detach: (() => void) | null = null;

  addLook(dx: number, dy: number) {
    this.lookAcc.x += dx;
    this.lookAcc.y += dy;
  }

  sample(): Actions {
    const k = (code: string) => this.keys.has(code) || this.injected.has(code);
    let mx = this.stick.x;
    let my = -this.stick.y;
    if (k("KeyD") || k("ArrowRight")) mx += 1;
    if (k("KeyA") || k("ArrowLeft")) mx -= 1;
    if (k("KeyW") || k("ArrowUp")) my += 1;
    if (k("KeyS") || k("ArrowDown")) my -= 1;

    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p || p.mapping !== "standard") continue;
      const st = radialDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0);
      mx += st.x;
      my += -st.y;
      const look = radialDeadzone(p.axes[2] ?? 0, p.axes[3] ?? 0, 0.12);
      this.lookAcc.x += look.x * 18;
      this.lookAcc.y += look.y * 14;
      if (p.buttons[9]?.pressed && !this.prevPause) this.pauseEdge = true;
      if (p.buttons[0]?.pressed && !this.prevLantern) this.lanternEdge = true;
      if (p.buttons[2]?.pressed && !this.prevFlash) this.flashEdge = true;
      this.prevPause = !!p.buttons[9]?.pressed;
      this.prevLantern = !!p.buttons[0]?.pressed;
      this.prevFlash = !!p.buttons[2]?.pressed;
    }

    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    const lookX = this.lookAcc.x;
    const lookY = this.lookAcc.y;
    this.lookAcc.x = 0;
    this.lookAcc.y = 0;
    const lantern = this.lanternEdge;
    const flash = this.flashEdge;
    const pause = this.pauseEdge;
    this.lanternEdge = false;
    this.flashEdge = false;
    this.pauseEdge = false;
    return { moveX: mx, moveY: my, lookX, lookY, lantern, flash, pause };

  }

  dispose() {
    this._detach?.();
    this._detach = null;
    this.keys.clear();
    this.injected.clear();
  }
}
