// The room's sound, made with Web Audio instead of recordings: wind in the trees, birds, the lake far below, and the
// cat. Nothing plays until the visitor clicks ENTER with sound on (browsers need that click anyway).

class Soundscape {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private wind!: GainNode;
  private purrGain!: GainNode;
  private noise!: AudioBuffer;
  private on = false;
  private birdTimer = 0;
  private gustTimer = 0;

  start(on: boolean) {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);
      this.noise = this.makeNoise(ctx, 4);
      this.leaves(ctx);
      this.lake(ctx);
      this.purrVoice(ctx);
    }
    this.setOn(on);
  }

  setOn(on: boolean) {
    this.on = on;
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && ctx.state === "suspended") void ctx.resume();
    this.master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4);
    window.clearTimeout(this.birdTimer);
    window.clearTimeout(this.gustTimer);
    if (on) {
      this.gusts();
      this.birdTimer = window.setTimeout(() => this.birds(), 1500);
    }
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

  private filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, Q = 1) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = Q;
    return f;
  }

  /** wind through the trees: a soft hiss that the gusts swell and settle */
  private leaves(ctx: AudioContext) {
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.03;
    this.loop(ctx).connect(this.filter(ctx, "bandpass", 900, 0.35)).connect(this.filter(ctx, "lowpass", 3200)).connect(this.wind).connect(this.master);
  }

  private gusts() {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    this.wind.gain.setTargetAtTime(0.018 + Math.random() * 0.06, ctx.currentTime, 1.2 + Math.random() * 1.6);
    this.gustTimer = window.setTimeout(() => this.gusts(), 2500 + Math.random() * 4500);
  }

  /** the lake far below: a low wash that comes and goes */
  private lake(ctx: AudioContext) {
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = ctx.createGain();
    depth.gain.value = 0.025;
    lfo.connect(depth).connect(g.gain);
    lfo.start();
    this.loop(ctx).connect(this.filter(ctx, "lowpass", 320)).connect(g).connect(this.master);
  }

  /** a bird somewhere in the trees: a few quick chirps, then a pause before the next */
  private birds() {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t0 = ctx.currentTime + 0.05, n = 2 + Math.floor(Math.random() * 5), base = 2600 + Math.random() * 2200;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.master);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const len = 0.06 + Math.random() * 0.08, f = base * (0.85 + Math.random() * 0.3);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.012, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + len + 0.02);
      t += len + 0.04 + Math.random() * 0.08;
    }
    this.birdTimer = window.setTimeout(() => this.birds(), 2200 + Math.random() * 6500);
  }

  /** the purr, made once as a few seconds of sound and looped: a train of soft low thumps about 25 a second (the
   * larynx twitching) through the chest's warmth, in breaths, a lighter, quicker in-breath and a fuller, slower
   * out-breath with a little pause between, each a touch different. Silent until the cat wakes. */
  private purrVoice(ctx: AudioContext) {
    const sr = ctx.sampleRate, breaths: [number, number, number, number][] = [];
    let end = 0;
    for (let k = 0; end < 8 || k % 2; k++) {
      const out = k % 2 === 1, len = out ? 1.1 + Math.random() * 0.25 : 0.8 + Math.random() * 0.15;
      breaths.push([end, len, out ? 1 : 0.55, out ? 23 + Math.random() : 26 + Math.random()]);
      end += len + 0.05 + Math.random() * 0.06;
    }
    const n = Math.floor(sr * end), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0, b = 0, phase = 0, hush = 0; i < n; i++) {
      const t = i / sr;
      while (b < breaths.length - 1 && t > breaths[b][0] + breaths[b][1]) b++;
      const [t0, len, loud, rate] = breaths[b], x = (t - t0) / len;
      const env = x <= 0 || x >= 1 ? 0 : Math.pow(Math.sin(Math.PI * x), 0.7) * loud;
      phase += (rate * (1 + 0.03 * Math.sin(t * 6.3))) / sr;
      const p = phase % 1;
      hush += (Math.random() * 2 - 1 - hush) * 0.08;
      // each pulse a damped low thump with a little breath in it
      d[i] = Math.exp(-p * 7) * (Math.sin(2 * Math.PI * p * 2.2) * 0.8 + hush * 1.6) * env * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    const chest = this.filter(ctx, "peaking", 140, 1.1);
    chest.gain.value = 4;
    this.purrGain = ctx.createGain();
    this.purrGain.gain.value = 0;
    src.connect(this.filter(ctx, "lowpass", 700)).connect(chest).connect(this.purrGain).connect(this.master);
  }

  purr(on: boolean) {
    if (!this.ctx) return;
    this.purrGain.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, on ? 0.3 : 0.6);
  }

  /** a cat's voice: a sawtooth gliding in pitch through two moving formants, "ee" opening to "ow" */
  private voice(f: [number, number, number], len: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f[0], t);
    o.frequency.linearRampToValueAtTime(f[1], t + len * 0.35);
    o.frequency.linearRampToValueAtTime(f[2], t + len);
    const f1 = this.filter(ctx, "bandpass", 600, 3), f2 = this.filter(ctx, "bandpass", 2400, 5);
    f1.frequency.linearRampToValueAtTime(850, t + len * 0.5);
    f2.frequency.linearRampToValueAtTime(1200, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(this.filter(ctx, "lowpass", 4000)).connect(this.master);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  meow() { this.voice([520, 820, 430], 0.7, 0.2); }
  mrrp() { this.voice([380, 540, 470], 0.22, 0.12); }

  /** a chord strummed down the strings, each a moment after the last. Each string is Karplus–Strong: a soft burst of
   * noise run round a delay line one period of the note long, averaged a little each time round, so it rings and
   * mellows like a plucked string; then a warm body under them all. */
  strum(freqs: number[]) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const t = ctx.currentTime, sr = ctx.sampleRate, len = Math.floor(sr * 3.2), fade = sr * 0.4;
    const warm = this.filter(ctx, "peaking", 190, 1.2);
    warm.gain.value = 5;
    const out = ctx.createGain();
    out.gain.value = 0.3;
    const body = this.filter(ctx, "lowpass", 3200);
    body.connect(warm).connect(out).connect(this.master);
    freqs.forEach((f, i) => {
      const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      const n = Math.max(2, Math.round(sr / f)), line = new Float32Array(n);
      for (let k = 0; k < n; k++) line[k] = Math.random() * 2 - 1;
      for (let k = 1; k < n; k++) line[k] = (line[k] + line[k - 1]) * 0.5; // a soft pick, not a sharp one
      for (let k = 0, p = 0; k < len; k++) {
        const q = p + 1 === n ? 0 : p + 1, v = line[p];
        line[p] = 0.4985 * (v + line[q]);
        d[k] = v * Math.min(1, (len - k) / fade);
        p = q;
      }
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf;
      g.gain.value = 0.85 - i * 0.07;
      src.connect(g).connect(body);
      src.start(t + i * 0.024);
    });
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
