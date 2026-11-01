// The room's sound, made with Web Audio instead of recordings: rain on the window, the city's hum, motorbikes in the
// alley, the fan. Nothing plays until the visitor clicks ENTER with sound on (browsers need that click anyway).

class Soundscape {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private fanGain!: GainNode;
  private noise!: AudioBuffer;
  private on = false;
  private dripTimer = 0;

  start(on: boolean) {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      this.noise = this.makeNoise(ctx, 4);
      this.rain(ctx);
      this.city(ctx);
      this.fan(ctx);
    }
    this.setOn(on);
  }

  setOn(on: boolean) {
    this.on = on;
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && ctx.state === "suspended") void ctx.resume();
    this.master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4);
    window.clearTimeout(this.dripTimer);
    if (on) this.drips();
  }

  private makeNoise(ctx: AudioContext, seconds: number) {
    const buf = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private loop(ctx: AudioContext) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    src.start(0, Math.random() * 3);
    return src;
  }

  private rain(ctx: AudioContext) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.value = 0.13;
    this.loop(ctx).connect(hp).connect(lp).connect(g).connect(this.master);
  }

  private city(ctx: AudioContext) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.2;
    // the hum swells and settles, slowly
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.04;
    const depth = ctx.createGain();
    depth.gain.value = 0.07;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    this.loop(ctx).connect(lp).connect(g).connect(this.master);
  }

  private fan(ctx: AudioContext) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 320;
    bp.Q.value = 0.6;
    this.fanGain = ctx.createGain();
    this.fanGain.gain.value = 0;
    this.loop(ctx).connect(bp).connect(this.fanGain).connect(this.master);
  }

  /** single drops tapping the sill */
  private drips() {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2500 + Math.random() * 3500;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.06, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 3, 0.08);
    this.dripTimer = window.setTimeout(() => this.drips(), 90 + Math.random() * 420);
  }

  setFan(speed: number) {
    if (!this.ctx) return;
    this.fanGain.gain.setTargetAtTime([0, 0.05, 0.08, 0.11][speed] ?? 0, this.ctx.currentTime, 0.5);
  }

  /** a motorbike passing the window: rises, pans across, drops in pitch as it goes */
  bike(dir: 1 | -1) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime, len = 3.2;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const f0 = 70 + Math.random() * 30;
    osc.frequency.setValueAtTime(f0 * 1.12, t);
    osc.frequency.linearRampToValueAtTime(f0 * 1.04, t + len * 0.48);
    osc.frequency.linearRampToValueAtTime(f0 * 0.88, t + len * 0.56);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + len * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.9 * dir, t);
    pan.pan.linearRampToValueAtTime(0.9 * dir, t + len);
    osc.connect(lp).connect(g).connect(pan).connect(this.master);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  click() {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.025, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.04);
  }
}

export const sound = new Soundscape();
