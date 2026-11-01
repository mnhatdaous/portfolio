import * as THREE from "three";

// Everything in the room is drawn in code: canvas textures for surfaces and for the screens' and notes' text.

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTexture(
  w: number,
  h: number,
  draw?: Draw,
  opts: { repeat?: [number, number]; color?: boolean; anisotropy?: number } = {},
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw?.(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = opts.color === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.anisotropy = opts.anisotropy ?? 8;
  if (opts.repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return { canvas, ctx, texture };
}

/** a small seeded random, so the room looks the same on every visit */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- fonts
// next/font gives the families hashed names; the CSS variables hold them.
const cssVar = (name: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};
export const FONT = {
  display: () => cssVar("--font-display", '"Be Vietnam Pro", system-ui, sans-serif'),
  mono: () => cssVar("--font-mono", "ui-monospace, Menlo, monospace"),
  hand: () => cssVar("--font-hand", '"Patrick Hand", cursive'),
};
let fontsP: Promise<void> | null = null;
/** resolves once the faces the canvases use are loaded (or after 3 s, whichever is first) */
export function fontsReady() {
  if (!fontsP) {
    const faces = [
      `400 20px ${FONT.display()}`, `700 20px ${FONT.display()}`, `800 20px ${FONT.display()}`,
      `400 20px ${FONT.mono()}`, `500 20px ${FONT.mono()}`, `700 20px ${FONT.mono()}`, `400 20px ${FONT.hand()}`,
    ];
    fontsP = Promise.race([
      Promise.all(faces.map((f) => document.fonts.load(f, "AĐăâêôơưạ"))).then(() => undefined),
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]).catch(() => undefined);
  }
  return fontsP;
}

/** wraps text to a width, returns the lines */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const t = line ? line + " " + word : word;
      if (ctx.measureText(t).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------- surfaces
export function woodTexture(seed = 1, base = "#7a4a2a", repeat?: [number, number]) {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y = r() * h;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? "40,20,8" : "160,110,70"},${0.05 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      const amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6;
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * f + ph) * amp);
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const x = r() * w, y = r() * h, g = ctx.createRadialGradient(x, y, 1, x, y, 10 + r() * 14);
      g.addColorStop(0, "rgba(40,20,8,.55)");
      g.addColorStop(1, "rgba(40,20,8,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat }).texture;
}

export function plasterTexture(base = "#9fbfae", repeat: [number, number] = [2, 2], seed = 7) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, rad = 40 + r() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.5 ? "255,255,240" : "60,70,60";
      g.addColorStop(0, `rgba(${c},${0.03 + r() * 0.04})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.06})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
  }, { repeat }).texture;
}

export function corkTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(3);
    ctx.fillStyle = "#b48552";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const v = r();
      ctx.fillStyle = v < 0.4 ? `rgba(95,60,30,${0.3 + r() * 0.4})` : v < 0.8 ? `rgba(215,170,115,${0.25 + r() * 0.4})` : `rgba(60,35,15,${0.4 + r() * 0.4})`;
      const s = 1 + r() * 2.6;
      ctx.fillRect(r() * w, r() * h, s, s);
    }
  }, { repeat: [1.6, 1.1] }).texture;
}

/** gạch bông: the patterned cement tiles of old Saigon houses. One tile; the floor repeats it. */
export function tileTexture(repeat: [number, number]) {
  return canvasTexture(512, 512, (ctx, S) => {
    const r = rng(11);
    const cream = "#e6dac2", terra = "#a84a33", teal = "#2c6763", ink = "#2a2826", mustard = "#c99a3a";
    ctx.fillStyle = cream;
    ctx.fillRect(0, 0, S, S);
    // corners: quarter circles that make full rings where four tiles meet
    for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S]]) {
      for (const [rad, col] of [[0.3, teal], [0.24, cream], [0.19, terra], [0.11, cream], [0.06, mustard]] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * S, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // middle of each edge: half diamonds that join into diamonds
    ctx.fillStyle = ink;
    for (const [x, y] of [[S / 2, 0], [S / 2, S], [0, S / 2], [S, S / 2]]) {
      ctx.beginPath();
      ctx.moveTo(x - 0.07 * S, y);
      ctx.lineTo(x, y - 0.07 * S);
      ctx.lineTo(x + 0.07 * S, y);
      ctx.lineTo(x, y + 0.07 * S);
      ctx.closePath();
      ctx.fill();
    }
    // the flower in the middle
    ctx.save();
    ctx.translate(S / 2, S / 2);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = terra;
      ctx.beginPath();
      ctx.ellipse(0.16 * S, 0, 0.12 * S, 0.055 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = teal;
      ctx.beginPath();
      ctx.ellipse(0.15 * S * Math.SQRT1_2, 0.15 * S * Math.SQRT1_2, 0.06 * S, 0.025 * S, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = mustard;
    ctx.beginPath();
    ctx.arc(0, 0, 0.05 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // a thin grout line and years of wear
    ctx.strokeStyle = "rgba(40,30,20,.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.6 ? "255,250,240" : "20,15,10"},${r() * 0.07})`;
      ctx.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
    }
  }, { repeat, anisotropy: 16 }).texture;
}

export function asphaltTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(5);
    ctx.fillStyle = "#15161a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "120,120,130"},${r() * 0.12})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  }, { repeat: [10, 3] }).texture;
}
