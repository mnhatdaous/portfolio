// The room's music: an hour-long chill mix served with the site, looping. It comes on with the room's other sounds when
// the visitor clicks ENTER with sound on; the button in the bottom bar pauses and resumes it, and the room's sound switch
// silences it along with everything else. Browsers only let a page start sound from a click, so every call that can
// start it comes straight from one.

/** the file is already levelled for the background (about -19 LUFS), so it plays at full volume */
const VOLUME = 1;

class Music {
  private el: HTMLAudioElement | null = null;
  private listeners = new Set<() => void>();
  private timer = 0;
  /** not paused with its button */
  private wanted = true;
  /** the room's sound is on */
  private on = false;

  /** the <audio> element in the bottom bar (it loads nothing until it first plays) */
  attach = (el: HTMLAudioElement | null) => {
    this.el = el;
    if (!el) return;
    el.volume = 0;
    el.addEventListener("play", this.emit);
    el.addEventListener("pause", this.emit);
  };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  playing = () => !!this.el && !this.el.paused;
  private emit = () => this.listeners.forEach((fn) => fn());

  /** the room's sound switch, and ENTER with the choice made at the gate */
  setSound(on: boolean) {
    this.on = on;
    this.apply();
  }
  /** the button: asking for the music is asking for sound, so the caller turns the room's sound on too */
  play() {
    this.wanted = this.on = true;
    this.apply();
  }
  pause() {
    this.wanted = false;
    this.apply();
  }

  private apply() {
    const a = this.el;
    if (!a) return;
    if (this.wanted && this.on) {
      // if the browser still blocks it, the button starts it
      if (a.paused) a.play().catch(() => {});
      this.fade(VOLUME, 1.6);
    } else if (!a.paused) {
      this.fade(0, 0.5, () => a.pause());
    }
  }

  /** ease the volume to `to` over `secs`; iOS ignores volume, so there it simply starts and stops */
  private fade(to: number, secs: number, done?: () => void) {
    const a = this.el;
    if (!a) return;
    clearInterval(this.timer);
    const from = a.volume, t0 = performance.now();
    this.timer = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      a.volume = from + (to - from) * k;
      if (k === 1) {
        clearInterval(this.timer);
        done?.();
      }
    }, 30);
  }
}

export const music = new Music();

// for poking at the music from the console while developing
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__music = music;
