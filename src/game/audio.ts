/*
  WebAudio の残響。見た目は持たない。unlock はユーザー操作のあと（iOS）。
*/
export class RuinAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: OscillatorNode | null = null;
  private windGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private stepCooldown = 0;

  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctr = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctr();
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;
    src.connect(filter);
    filter.connect(windGain);
    windGain.connect(master);
    src.start();

    this.ctx = ctx;
    this.master = master;
    this.windGain = windGain;
    this.filter = filter;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  setAir(openSky: number, speed: number) {
    if (!this.filter || !this.windGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(280 + openSky * 900 + speed * 40, t, 0.15);
    this.windGain.gain.setTargetAtTime(0.08 + openSky * 0.1, t, 0.2);
  }

  foot(dt: number, speed: number) {
    if (!this.ctx || !this.master || speed < 0.4) {
      this.stepCooldown = Math.max(0, this.stepCooldown - dt);
      return;
    }
    this.stepCooldown -= dt;
    const interval = Math.max(0.28, 0.52 - speed * 0.04);
    if (this.stepCooldown > 0) return;
    this.stepCooldown = interval;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 70 + Math.random() * 30;
    g.gain.value = 0.08;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  chime() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    for (const [i, f] of [392, 523, 659].entries()) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.value = 0.07;
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + i * 0.05);
      o.connect(g);
      g.connect(this.master);
      o.start(now + i * 0.04);
      o.stop(now + 1);
    }
  }

  flash() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(620, now);
    o.frequency.exponentialRampToValueAtTime(90, now + 0.28);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    o.connect(g);
    g.connect(this.master);
    o.start(now);
    o.stop(now + 0.5);
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = "sine";
    o2.frequency.value = 180;
    g2.gain.setValueAtTime(0.06, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    o2.connect(g2);
    g2.connect(this.master);
    o2.start(now);
    o2.stop(now + 0.95);
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
