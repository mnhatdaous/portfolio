"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { profile } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng } from "../lib/textures";
import { useRoom } from "../store";
import { ROOM } from "./Room";

// The calendar on the back wall: a wire-bound wall calendar hanging from a nail, a picture of the lake through the
// year over each month's dates. Up close a click flips the page up over the wire to the next month, a year ahead at
// most and then back to this one; the arrow keys go either way. Drawn at 3,600 px a metre so it stays sharp up close.

const PAGE = { w: 0.3, h: 0.4167 }, CW = 1080, CH = 1500, PX = CW / PAGE.w;
/** the punched holes along the top, 1 cm apart, with a gap in the middle for the hanger */
const HOLE_Y = 26, HOLES = Array.from({ length: 27 }, (_, i) => 72 + i * 36).filter((x) => Math.abs(x - CW / 2) > 40);
const INK = "#2b2622", SUN_RED = "#e5383b", SAT_BLUE = "#2f80ed";
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the days worth a mark
// Tết and the Mid-Autumn Festival follow the moon, so they're looked up; the rest are the same every year.
const TET: Record<number, [number, number]> = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] };
const TRUNG_THU: Record<number, [number, number]> = { 2025: [10, 6], 2026: [9, 25], 2027: [9, 15], 2028: [10, 3], 2029: [9, 22], 2030: [9, 12] };
const FIXED: [number, number][] = [[1, 1], [3, 8], [4, 30], [5, 1], [6, 1], [9, 2], [10, 20], [11, 20], [12, 24], [12, 25]];

function marks(y: number, m: number) {
  const days = new Map<number, "star" | "heart">();
  for (const [fm, fd] of FIXED) if (fm === m) days.set(fd, "star");
  for (const t of [TET[y], TRUNG_THU[y]]) if (t && t[0] === m) days.set(t[1], "star");
  if (m === 2) days.set(14, "heart");
  return days;
}

/** Saigon's month today, `offset` months on, and today's date if it's this month */
function monthOf(offset: number) {
  const now = new Date(), part = (o: Intl.DateTimeFormatOptions) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: profile.timeZone, ...o }).format(now));
  const i = part({ month: "numeric" }) - 1 + offset;
  return { y: part({ year: "numeric" }) + Math.floor(i / 12), m: (i % 12) + 1, today: offset === 0 ? part({ day: "numeric" }) : -1 };
}
const monthName = (y: number, m: number) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));

// ---------------------------------------------------------------- drawing kit
type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, w: number, h: number, r: () => number, sky: CanvasGradient) => void;

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
function poly(c: Ctx, pts: number[]) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}
function disc(c: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient) {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function starPath(c: Ctx, x: number, y: number, r: number, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
function heartPath(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  c.closePath();
}
function glow(c: Ctx, x: number, y: number, r: number, col: string, a = 0.5) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  disc(c, x, y, r, g);
}

// ---------------------------------------------------------------- the picture: the lake through the year
const HORIZON = 0.6;
/** the near bank: high at both ends, low in the middle where the lake shows */
const bank = (x: number, w: number, h: number) =>
  h * 0.9 - 80 * Math.exp(-((x / (w * 0.2)) ** 2)) - 60 * Math.exp(-(((x - w) / (w * 0.17)) ** 2)) + Math.sin(x / 60) * 4;

const FIR: [number, number, number][] = [[0.52, 0.1, 0.34], [0.78, 0.36, 0.27], [1, 0.6, 0.19]];
function fir(c: Ctx, x: number, base: number, ht: number, col: string, frost?: boolean) {
  c.fillStyle = "#6b4a2f";
  c.fillRect(x - ht * 0.035, base - ht * 0.14, ht * 0.07, ht * 0.16);
  for (const [top, bot, half] of FIR) {
    c.fillStyle = col;
    poly(c, [x, base - ht * top, x - ht * half, base - ht * bot, x + ht * half, base - ht * bot]);
    c.fill();
    if (!frost) continue;
    const k = 0.42, y = base - ht * (top - (top - bot) * k);
    c.fillStyle = "#ffffff";
    poly(c, [x, base - ht * top, x - ht * half * k, y, x + ht * half * k, y]);
    c.fill();
  }
}
function crown(c: Ctx, x: number, base: number, ht: number, col: string) {
  c.fillStyle = "#7a5233";
  c.fillRect(x - ht * 0.04, base - ht * 0.5, ht * 0.08, ht * 0.52);
  for (const [dx, dy, rr] of [[0, -0.72, 0.28], [-0.2, -0.56, 0.22], [0.2, -0.58, 0.22], [0, -0.5, 0.2]]) disc(c, x + dx * ht, base + dy * ht, rr * ht, col);
  disc(c, x - ht * 0.08, base - ht * 0.8, ht * 0.1, "rgba(255,255,255,.14)");
}
function cloud(c: Ctx, x: number, y: number, s: number, col = "#ffffff") {
  for (const [dx, dy, rr] of [[0, 0, 0.5], [0.45, 0.1, 0.38], [-0.45, 0.12, 0.36], [0.15, -0.25, 0.4]]) disc(c, x + dx * s, y + dy * s, rr * s, col);
}
function sun(c: Ctx, x: number, y: number, r: number, col: string, rays = true) {
  glow(c, x, y, r * 2.4, col, 0.45);
  if (rays) {
    c.fillStyle = rgba(col, 0.7);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, p = (d: number, o: number) => [x + Math.cos(a + o) * r * d, y + Math.sin(a + o) * r * d];
      poly(c, [...p(1.2, -0.1), ...p(1.65, 0), ...p(1.2, 0.1)]);
      c.fill();
    }
  }
  disc(c, x, y, r, col);
}
function flakes(c: Ctx, w: number, h: number, r: () => number, n: number) {
  for (let i = 0; i < n; i++) disc(c, r() * w, r() * h, 2.5 + r() * 4.5, "rgba(255,255,255,.9)");
}
function stars(c: Ctx, w: number, h: number, r: () => number, n: number) {
  for (let i = 0; i < n; i++) disc(c, r() * w, r() * h * HORIZON * 0.9, 1.2 + r() * 2.6, `rgba(255,252,235,${0.45 + r() * 0.55})`);
}
function gulls(c: Ctx, x: number, y: number, col = "rgba(40,40,40,.6)") {
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.lineCap = "round";
  for (const [dx, dy, s] of [[0, 0, 1], [52, 24, 0.8], [-42, 32, 0.7]]) {
    c.beginPath();
    c.moveTo(x + dx - 13 * s, y + dy - 3 * s);
    c.quadraticCurveTo(x + dx - 6 * s, y + dy - 11 * s, x + dx, y + dy);
    c.quadraticCurveTo(x + dx + 6 * s, y + dy - 11 * s, x + dx + 13 * s, y + dy - 3 * s);
    c.stroke();
  }
}

type Theme = {
  accent: string;
  caption: string;
  sky: [string, string];
  far: string;
  /** snow on the high hills */
  snow?: boolean;
  lake: [string, string];
  shore: string;
  /** firs on the left bank (white-tipped in winter), and the trees on the right: round ones, or firs if `rightFirs` */
  firs: string;
  frost?: boolean;
  right: string[];
  rightFirs?: boolean;
  night?: boolean;
  back?: Draw;
  front?: Draw;
};

function landscape(c: Ctx, w: number, h: number, t: Theme, seed: number) {
  const r = rng(seed), horizon = h * HORIZON;
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, t.sky[0]);
  sky.addColorStop(1, t.sky[1]);
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  t.back?.(c, w, h, r, sky);
  // the far hills, with snow on the high ones in winter
  const hills = [0, horizon];
  for (let x = -20, up = true; x < w + 120; x += 80 + r() * 90, up = !up) hills.push(x, horizon - h * (up ? 0.15 + r() * 0.13 : 0.05 + r() * 0.05));
  hills.push(w + 120, horizon);
  poly(c, hills);
  c.fillStyle = t.far;
  c.fill();
  if (t.snow) {
    c.save();
    poly(c, hills);
    c.clip();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(0, 0);
    for (let x = 0; x <= w; x += 30) c.lineTo(x, horizon - h * 0.2 + Math.sin(x / 23) * 8);
    c.lineTo(w, 0);
    c.closePath();
    c.fill();
    c.restore();
  }
  // the lake, and the light on it
  const lake = c.createLinearGradient(0, horizon, 0, h);
  lake.addColorStop(0, t.lake[0]);
  lake.addColorStop(1, t.lake[1]);
  c.fillStyle = lake;
  c.fillRect(0, horizon, w, h - horizon);
  c.fillStyle = t.night ? "rgba(255,240,190,.28)" : "rgba(255,255,255,.5)";
  for (let i = 0; i < 24; i++) c.fillRect(r() * w, horizon + 10 + r() * h * 0.22, 24 + r() * 70, 3);
  // the near bank and its trees
  c.fillStyle = t.shore;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w; x += 12) c.lineTo(x, bank(x, w, h));
  c.lineTo(w, h);
  c.closePath();
  c.fill();
  for (const [x, s] of [[34, 1], [96, 1.25], [160, 0.9]]) fir(c, x, bank(x, w, h) + 6, 150 * s, t.firs, t.frost);
  t.right.forEach((col, i) => {
    const x = w - 50 - i * 78;
    if (t.rightFirs) fir(c, x, bank(x, w, h) + 6, 170 - i * 30, col, t.frost);
    else crown(c, x, bank(x, w, h) + 6, 150 - i * 18, col);
  });
  t.front?.(c, w, h, r, sky);
}

// ---------------------------------------------------------------- what each month is about
function snowman(c: Ctx, x: number, b: number) {
  c.strokeStyle = "rgba(80,120,170,.35)";
  c.lineWidth = 4;
  for (const [dy, rr] of [[-52, 54], [-138, 40], [-204, 29]]) {
    disc(c, x, b + dy, rr, "#ffffff");
    c.beginPath();
    c.arc(x, b + dy, rr, 0, TAU);
    c.stroke();
  }
  // a red scarf, coal eyes and buttons, a carrot, stick arms, a bobble hat
  c.fillStyle = "#e63946";
  rrect(c, x - 32, b - 182, 64, 14, 7);
  c.fill();
  rrect(c, x + 8, b - 176, 14, 46, 6);
  c.fill();
  for (const [dx, dy] of [[-10, -210], [10, -210], [0, -150], [0, -126], [0, -102]]) disc(c, x + dx, b + dy, 4.5, INK);
  c.fillStyle = "#f4a261";
  poly(c, [x, b - 203, x, b - 194, x + 34, b - 198]);
  c.fill();
  c.strokeStyle = "#6b4a2f";
  c.lineWidth = 5;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x - 38, b - 145); c.lineTo(x - 90, b - 180);
  c.moveTo(x - 72, b - 168); c.lineTo(x - 80, b - 188);
  c.moveTo(x + 38, b - 145); c.lineTo(x + 92, b - 170);
  c.stroke();
  c.fillStyle = "#2f80ed";
  c.beginPath();
  c.arc(x, b - 220, 28, Math.PI, TAU);
  c.fill();
  rrect(c, x - 31, b - 224, 62, 11, 5);
  c.fill();
  disc(c, x, b - 250, 9, "#ffffff");
}

/** hoa mai: a branch of yellow apricot blossom, reaching in from the top left */
function blossom(c: Ctx) {
  c.strokeStyle = "#6b3f26";
  c.lineCap = "round";
  const twigs: [number, number[]][] = [[13, [-10, 30, 170, 40, 360, 150]], [8, [150, 42, 230, 120, 230, 220]], [7, [270, 95, 340, 70, 420, 40]], [6, [330, 130, 380, 190, 450, 210]]];
  for (const [lw, [x0, y0, cx, cy, x1, y1]] of twigs) {
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(cx, cy, x1, y1);
    c.stroke();
  }
  const r = rng(5);
  const at = [[60, 36], [120, 42], [190, 62], [255, 95], [320, 128], [356, 146], [195, 90], [222, 150], [230, 205], [310, 82], [370, 62], [416, 42], [366, 168], [410, 198], [448, 210]];
  for (const [x, y] of at) {
    const s = 13 + r() * 8, cx = x + (r() - 0.5) * 8, cy = y + (r() - 0.5) * 8;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU - Math.PI / 2 + r() * 0.3;
      disc(c, cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.62, s * 0.5, "#ffd23f");
    }
    disc(c, cx, cy, s * 0.3, "#f08c00");
  }
}
function lantern(c: Ctx, x: number, y: number, s: number) {
  c.strokeStyle = "#8a5a00";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, 0);
  c.lineTo(x, y - 60 * s);
  c.stroke();
  glow(c, x, y, 110 * s, "#ff6b6b", 0.35);
  c.fillStyle = "#f2b705";
  rrect(c, x - 26 * s, y - 64 * s, 52 * s, 12 * s, 4);
  c.fill();
  rrect(c, x - 26 * s, y + 52 * s, 52 * s, 12 * s, 4);
  c.fill();
  c.fillStyle = "#e63946";
  c.beginPath();
  c.ellipse(x, y, 62 * s, 56 * s, 0, 0, TAU);
  c.fill();
  c.strokeStyle = "rgba(120,10,20,.35)";
  c.lineWidth = 3;
  for (const k of [0.01, 0.55]) {
    c.beginPath();
    c.ellipse(x, y, k * 62 * s, 56 * s, 0, 0, TAU);
    c.stroke();
  }
  c.strokeStyle = "#f2b705";
  c.lineWidth = 4;
  c.beginPath();
  for (let i = -2; i <= 2; i++) {
    c.moveTo(x + i * 5 * s, y + 64 * s);
    c.lineTo(x + i * 6 * s, y + 112 * s);
  }
  c.stroke();
}

function kite(c: Ctx, x: number, y: number, s: number, a: string, b: string, hx: number, hy: number) {
  // the line down to someone on the bank, and a tail of bows
  c.strokeStyle = "rgba(50,50,50,.5)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x - s * 0.3, (y + hy) / 2 + 50, hx, hy);
  c.stroke();
  const tail = (i: number) => [x + Math.sin(i * 1.3) * 18 + i * 9, y + s * 1.3 + i * 22];
  c.strokeStyle = a;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y + s * 1.3);
  for (let i = 1; i <= 6; i++) c.lineTo(tail(i)[0], tail(i)[1]);
  c.stroke();
  c.fillStyle = b === "#ffffff" ? a : b;
  for (let i = 2; i <= 6; i += 2) {
    const [bx, by] = tail(i);
    poly(c, [bx, by, bx - 11, by - 7, bx - 11, by + 7]);
    c.fill();
    poly(c, [bx, by, bx + 11, by - 7, bx + 11, by + 7]);
    c.fill();
  }
  // the sail, in four panels, and its cross of sticks
  const T = [x, y - s], R = [x + s * 0.72, y], B = [x, y + s * 1.3], L = [x - s * 0.72, y];
  ([[T, R, a], [R, B, b], [B, L, a], [L, T, b]] as [number[], number[], string][]).forEach(([p, q, col]) => {
    c.fillStyle = col;
    poly(c, [p[0], p[1], q[0], q[1], x, y]);
    c.fill();
  });
  c.strokeStyle = "rgba(40,30,20,.5)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(T[0], T[1]); c.lineTo(B[0], B[1]);
  c.moveTo(L[0], L[1]); c.lineTo(R[0], R[1]);
  c.stroke();
}

function rainbow(c: Ctx, x: number, y: number, R: number) {
  ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#52a675", "#1982c4", "#6a4c93"].forEach((col, i) => {
    c.strokeStyle = rgba(col, 0.8);
    c.lineWidth = 18;
    c.beginPath();
    c.arc(x, y, R - i * 17, Math.PI, TAU);
    c.stroke();
  });
}
function rain(c: Ctx, x: number, y0: number, wd: number, y1: number) {
  const r = rng(17);
  c.strokeStyle = "rgba(80,120,185,.55)";
  c.lineWidth = 3;
  c.lineCap = "round";
  for (let i = 0; i < 34; i++) {
    const sx = x - wd / 2 + r() * wd, sy = y0 + r() * (y1 - y0), l = 18 + r() * 14;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx - 6, sy + l);
    c.stroke();
  }
}
/** an open umbrella, its pole stuck in the ground at (x, b) */
function umbrella(c: Ctx, x: number, b: number, s: number, col: string, stripe = "#ffffff") {
  c.strokeStyle = "#5b4636";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x, b);
  c.lineTo(x + s * 0.16, b - s * 1.9);
  c.stroke();
  c.save();
  c.translate(x + s * 0.16, b - s * 1.9);
  c.rotate(0.08);
  for (let k = 0; k < 6; k++) {
    c.fillStyle = k % 2 ? stripe : col;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, s, Math.PI + (k / 6) * Math.PI, Math.PI + ((k + 1) / 6) * Math.PI);
    c.closePath();
    c.fill();
  }
  disc(c, 0, -s - 4, 6, "#5b4636");
  c.restore();
}

function sailboat(c: Ctx, x: number, y: number) {
  c.strokeStyle = "rgba(255,255,255,.45)";
  c.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(x - 70 + i * 14, y + 22 + i * 10);
    c.quadraticCurveTo(x, y + 30 + i * 10, x + 70 - i * 14, y + 22 + i * 10);
    c.stroke();
  }
  c.fillStyle = "#e63946";
  poly(c, [x - 90, y - 20, x + 90, y - 20, x + 64, y + 12, x - 64, y + 12]);
  c.fill();
  c.strokeStyle = "#5b4636";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x, y - 20);
  c.lineTo(x, y - 196);
  c.stroke();
  c.fillStyle = "#ffffff";
  poly(c, [x + 4, y - 190, x + 4, y - 32, x + 98, y - 32]);
  c.fill();
  c.fillStyle = "#3a86ff";
  poly(c, [x + 4, y - 112, x + 4 + 94 * (78 / 158), y - 112, x + 4 + 94 * (96 / 158), y - 94, x + 4, y - 94]);
  c.fill();
  c.fillStyle = "#fbf3e2";
  poly(c, [x - 4, y - 160, x - 4, y - 32, x - 72, y - 32]);
  c.fill();
  c.fillStyle = "#ffca3a";
  poly(c, [x, y - 196, x + 26, y - 188, x, y - 180]);
  c.fill();
}

function towel(c: Ctx, x: number, y: number) {
  c.save();
  c.translate(x, y);
  c.rotate(-0.06);
  ["#3a86ff", "#ffffff", "#3a86ff", "#ffffff", "#3a86ff"].forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(i * 18, 0, 18, 34);
  });
  c.restore();
}
function swimRing(c: Ctx, x: number, y: number) {
  c.lineWidth = 13;
  for (let k = 0; k < 8; k++) {
    c.strokeStyle = k % 2 ? "#ffffff" : "#ff6b35";
    c.beginPath();
    c.ellipse(x, y, 36, 13, 0, (k / 8) * TAU, ((k + 1) / 8) * TAU);
    c.stroke();
  }
}

function balloon(c: Ctx, x: number, y: number, s: number, cols: string[]) {
  const envelope = () => {
    c.beginPath();
    c.moveTo(x, y + s * 1.25);
    c.bezierCurveTo(x - s * 0.35, y + s * 0.95, x - s * 1.05, y + s * 0.45, x - s, y);
    c.arc(x, y, s, Math.PI, TAU);
    c.bezierCurveTo(x + s * 1.05, y + s * 0.45, x + s * 0.35, y + s * 0.95, x, y + s * 1.25);
    c.closePath();
  };
  c.save();
  envelope();
  c.clip();
  for (let i = 0; i < 6; i++) {
    c.fillStyle = cols[i % cols.length];
    c.fillRect(x - s + (i * s) / 3, y - s, s / 3 + 1, s * 2.4);
  }
  const g = c.createLinearGradient(x - s, 0, x + s, 0);
  g.addColorStop(0, "rgba(255,255,255,.28)");
  g.addColorStop(0.55, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.2)");
  c.fillStyle = g;
  c.fillRect(x - s, y - s, 2 * s, s * 2.4);
  c.restore();
  c.strokeStyle = "rgba(70,50,30,.8)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x - s * 0.18, y + s * 1.18); c.lineTo(x - s * 0.17, y + s * 1.5);
  c.moveTo(x + s * 0.18, y + s * 1.18); c.lineTo(x + s * 0.17, y + s * 1.5);
  c.stroke();
  c.fillStyle = "#8d5a2b";
  rrect(c, x - s * 0.2, y + s * 1.5, s * 0.4, s * 0.28, 4);
  c.fill();
}

function canoe(c: Ctx, x: number, y: number) {
  const col = "#3d2c3e";
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x - 84, y - 10);
  c.quadraticCurveTo(x, y + 22, x + 84, y - 10);
  c.quadraticCurveTo(x, y + 4, x - 84, y - 10);
  c.fill();
  disc(c, x + 6, y - 46, 10, col);
  rrect(c, x - 4, y - 36, 20, 32, 9);
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x - 34, y - 56);
  c.lineTo(x + 34, y + 16);
  c.stroke();
}

function moon(c: Ctx, x: number, y: number, r: number) {
  glow(c, x, y, r * 2.6, "#fff3b0", 0.4);
  disc(c, x, y, r, "#fff3b0");
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.18], [0.25, 0.15, 0.22], [0.05, -0.45, 0.1], [-0.15, 0.4, 0.12]]) disc(c, x + dx * r, y + dy * r, rr * r, "rgba(225,200,120,.35)");
}
/** đèn ông sao: a five-pointed star lantern held up on a stick */
function starLantern(c: Ctx, x: number, y: number, s: number, col: string, b: number) {
  glow(c, x, y, s * 3, col, 0.5);
  c.strokeStyle = "#c9a227";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y + s * 0.4);
  c.lineTo(x - s * 0.25, b);
  c.stroke();
  starPath(c, x, y, s);
  c.fillStyle = col;
  c.fill();
  c.strokeStyle = "#ffe9a8";
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = rgba(col, 0.9);
  c.beginPath();
  for (const k of [1, 4]) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s + s * 0.8);
  }
  c.stroke();
}

function leaves(c: Ctx, w: number, h: number, r: () => number, cols: string[], n: number) {
  for (let i = 0; i < n; i++) {
    const s = 7 + r() * 7;
    c.save();
    c.translate(r() * w, r() * h * 0.85);
    c.rotate(r() * TAU);
    c.fillStyle = cols[i % cols.length];
    c.beginPath();
    c.ellipse(0, 0, s, s * 0.55, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(90,40,10,.5)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-s, 0);
    c.lineTo(s * 1.35, 0);
    c.stroke();
    c.restore();
  }
}

function cabin(c: Ctx, x: number, b: number) {
  for (let i = 0; i < 5; i++) disc(c, x + 48 + i * 9 + Math.sin(i * 1.7) * 7, b - 172 - i * 26, 10 + i * 4, `rgba(242,236,248,${0.6 - i * 0.1})`);
  c.fillStyle = "#4a3b52";
  c.fillRect(x + 36, b - 160, 22, 52);
  c.fillStyle = "#a0522d";
  c.fillRect(x - 70, b - 90, 140, 92);
  c.fillStyle = "#3d2c3e";
  poly(c, [x - 90, b - 86, x, b - 152, x + 90, b - 86]);
  c.fill();
  glow(c, x - 30, b - 48, 80, "#ffd27a", 0.55);
  c.fillStyle = "#ffd27a";
  c.fillRect(x - 50, b - 66, 40, 34);
  c.strokeStyle = "#5a3a22";
  c.lineWidth = 3;
  c.strokeRect(x - 50, b - 66, 40, 34);
  c.beginPath();
  c.moveTo(x - 30, b - 66); c.lineTo(x - 30, b - 32);
  c.moveTo(x - 50, b - 49); c.lineTo(x - 10, b - 49);
  c.stroke();
  c.fillStyle = "#5a3a22";
  c.fillRect(x + 14, b - 60, 30, 62);
}

function gift(c: Ctx, x: number, b: number, s: number, box: string, ribbon: string) {
  c.fillStyle = box;
  rrect(c, x - s / 2, b - s, s, s, 4);
  c.fill();
  c.fillStyle = ribbon;
  c.fillRect(x - 4, b - s, 8, s);
  c.fillRect(x - s / 2, b - s * 0.6, s, 7);
  for (const d of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + d * 9, b - s - 6, 10, 6, d * 0.5, 0, TAU);
    c.fill();
  }
}
function holidayTree(c: Ctx, x: number, b: number, ht: number) {
  fir(c, x, b, ht, "#1f6b4f");
  const r = rng(12), cols = ["#ff595e", "#ffca3a", "#8ac926", "#4cc9f0", "#ff924c"];
  for (let i = 0; i < 36; i++) {
    const [top, bot, half] = FIR[Math.floor(r() * 3)], f = 0.22 + r() * 0.78;
    const y = b - ht * (top - (top - bot) * f), px = x + (r() * 2 - 1) * ht * half * f * 0.82, col = cols[i % cols.length];
    glow(c, px, y, 16, col, 0.55);
    disc(c, px, y, 5.5, col);
  }
  glow(c, x, b - ht * 1.03, 60, "#ffd23f", 0.5);
  starPath(c, x, b - ht * 1.03, 24);
  c.fillStyle = "#ffd23f";
  c.fill();
  gift(c, x - 62, b + 2, 46, "#e63946", "#ffd23f");
  gift(c, x + 46, b + 2, 38, "#3a86ff", "#ffffff");
  gift(c, x - 12, b + 6, 30, "#8ac926", "#e63946");
}

const THEMES: Theme[] = [
  {
    accent: "#2f80ed", caption: "Fresh snow, fresh start",
    sky: ["#a9d6ff", "#eef8ff"], far: "#8fb0d6", snow: true, lake: ["#d9eefa", "#b5d6ea"], shore: "#f4f9ff",
    firs: "#2e6b5e", frost: true, right: ["#2e6b5e", "#3b7d69"], rightFirs: true,
    front: (c, w, h, r) => { snowman(c, w * 0.62, bank(w * 0.62, w, h) + 34); flakes(c, w, h, r, 80); },
  },
  {
    accent: "#e63946", caption: "Chúc mừng năm mới!",
    sky: ["#ffc9b5", "#fff3e6"], far: "#f0a99a", lake: ["#ffd9c9", "#f5b7a1"], shore: "#a8d08d",
    firs: "#3f7d4e", right: ["#f6c445", "#f28482"],
    front: (c, w) => { blossom(c); lantern(c, w - 120, 185, 1); lantern(c, w - 236, 120, 0.72); },
  },
  {
    accent: "#2a9d8f", caption: "Kite weather",
    sky: ["#8fd3ff", "#e3f6ff"], far: "#86c2a0", lake: ["#78c1e6", "#3f97cf"], shore: "#7cc46a",
    firs: "#2f7d4f", right: ["#58b368", "#86cf6b"],
    back: (c, w) => { cloud(c, w * 0.16, 92, 70); cloud(c, w * 0.86, 70, 50); },
    front: (c, w, h) => {
      kite(c, w * 0.6, 120, 70, "#e63946", "#ffd23f", w * 0.5, bank(w * 0.5, w, h) + 10);
      kite(c, w * 0.34, 200, 44, "#3a86ff", "#ffffff", w * 0.44, bank(w * 0.44, w, h) + 10);
    },
  },
  {
    accent: "#6a4c93", caption: "Rain, then rainbows",
    sky: ["#9fc4ea", "#e6f0fa"], far: "#8fb1c7", lake: ["#8cbad8", "#5f95bf"], shore: "#88c47a",
    firs: "#2f7d4f", right: ["#5cb85c", "#7fcf6f"],
    back: (c, w, h) => { rainbow(c, w * 0.64, h * HORIZON, h * 0.52); rain(c, w * 0.22, 130, 170, h * HORIZON); cloud(c, w * 0.22, 105, 84, "#f4f7fb"); },
    front: (c, w, h) => umbrella(c, w * 0.7, bank(w * 0.7, w, h) + 30, 64, "#ffca3a"),
  },
  {
    accent: "#f29e1f", caption: "Sun on the lake",
    sky: ["#6fcaff", "#dff5ff"], far: "#6eab96", lake: ["#3ba6e0", "#1d78b8"], shore: "#6cc26a",
    firs: "#2c7a4b", right: ["#4caf50", "#7bc96f"],
    back: (c, w) => { sun(c, w * 0.8, 110, 60, "#ffd23f"); cloud(c, w * 0.3, 84, 46); },
    front: (c, w, h) => { sailboat(c, w * 0.44, h * 0.76); gulls(c, w * 0.6, 150); },
  },
  {
    accent: "#ef476f", caption: "Hello, summer!",
    sky: ["#4cc3f0", "#d4f3ff"], far: "#5fa58a", lake: ["#22a6d9", "#137fb6"], shore: "#f2d59a",
    firs: "#2c7a4b", right: ["#3fa34d", "#66bb6a"],
    back: (c, w) => sun(c, w * 0.2, 100, 54, "#ffe066"),
    front: (c, w, h) => {
      const x = w * 0.62, b = bank(x, w, h) + 34;
      towel(c, x - 120, b - 20);
      umbrella(c, x, b, 80, "#ef476f");
      swimRing(c, w * 0.38, h * 0.74);
    },
  },
  {
    accent: "#ff7b54", caption: "Up and away",
    sky: ["#8ed6ff", "#fff1d8"], far: "#86b98e", lake: ["#4db0dd", "#2a87bd"], shore: "#78c26a",
    firs: "#2c7a4b", right: ["#4caf50", "#8bc34a"],
    back: (c, w) => { cloud(c, w * 0.76, 70, 52); cloud(c, w * 0.1, 140, 40); },
    front: (c, w) => {
      balloon(c, w * 0.28, 200, 66, ["#ff595e", "#ffca3a"]);
      balloon(c, w * 0.58, 118, 92, ["#1982c4", "#ffffff", "#8ac926"]);
      balloon(c, w * 0.84, 250, 48, ["#6a4c93", "#ff924c"]);
    },
  },
  {
    accent: "#e76f51", caption: "Long golden evenings",
    sky: ["#ff8fa3", "#ffd6a0"], far: "#b56576", lake: ["#ffb38a", "#c9705f"], shore: "#6d8f55",
    firs: "#2f5d46", right: ["#5a8f4e", "#7aa65a"],
    back: (c, w, h) => sun(c, w * 0.5, h * 0.56, 84, "#fff1a8", false),
    front: (c, w, h) => {
      c.fillStyle = "rgba(255,241,168,.5)";
      for (let i = 0; i < 9; i++) c.fillRect(w * 0.5 - (44 - i * 4), h * HORIZON + 8 + i * 13, 88 - i * 8, 4);
      canoe(c, w * 0.34, h * 0.75);
      gulls(c, w * 0.72, 130, "rgba(80,40,50,.6)");
    },
  },
  {
    accent: "#f4a259", caption: "Trung Thu vui vẻ!", night: true,
    sky: ["#16204a", "#3c3f8a"], far: "#262f63", lake: ["#26346c", "#141d45"], shore: "#1f2d52",
    firs: "#16233f", right: ["#1d3550", "#223b5c"],
    back: (c, w, h, r) => { stars(c, w, h, r, 80); moon(c, w * 0.7, 128, 66); },
    front: (c, w, h) => {
      c.fillStyle = "rgba(255,243,176,.55)";
      for (let i = 0; i < 10; i++) c.fillRect(w * 0.7 - (36 - i * 2.5), h * HORIZON + 10 + i * 14, 72 - i * 5, 4);
      ([[0.3, "#ff595e", 30], [0.44, "#ffca3a", 26], [0.55, "#ff8fab", 22]] as [number, string, number][]).forEach(([f, col, s], i) => {
        const x = w * f, b = bank(x, w, h) + 20;
        starLantern(c, x, b - 120 - (i % 2) * 26, s, col, b);
      });
    },
  },
  {
    accent: "#e07a2f", caption: "Golden leaves",
    sky: ["#ffc98b", "#fff1dc"], far: "#d4956a", lake: ["#9cc5d6", "#6fa3bd"], shore: "#c9873f",
    firs: "#2f5d46", right: ["#e85d04", "#f48c06", "#dc2f02"],
    back: (c, w) => cloud(c, w * 0.6, 84, 44, "#fffaf0"),
    front: (c, w, h, r) => leaves(c, w, h, r, ["#e85d04", "#f48c06", "#dc2f02", "#ffba08"], 34),
  },
  {
    accent: "#8e5572", caption: "Cozy season",
    sky: ["#7c6fb0", "#f2c4a8"], far: "#6d6098", lake: ["#9b8ccc", "#6f5f9e"], shore: "#56607d",
    firs: "#2c3e50", right: ["#7d5a50"],
    back: (c, w, h, r, sky) => { stars(c, w, h * 0.7, r, 30); disc(c, w * 0.2, 100, 40, "#fff1c1"); disc(c, w * 0.2 + 18, 90, 36, sky); },
    front: (c, w, h) => cabin(c, w * 0.66, bank(w * 0.66, w, h) + 26),
  },
  {
    accent: "#2a9d8f", caption: "Merry and bright", night: true,
    sky: ["#1b2f5e", "#4a6aa5"], far: "#7e93bd", snow: true, lake: ["#56779f", "#34507d"], shore: "#eef5ff",
    firs: "#1f4d45", frost: true, right: [],
    back: (c, w, h, r) => stars(c, w, h, r, 60),
    front: (c, w, h, r) => { holidayTree(c, w * 0.72, bank(w * 0.72, w, h) + 34, 300); flakes(c, w, h, r, 70); },
  },
];

// ---------------------------------------------------------------- the page
const PIC = { x: 54, y: 92, w: 972, h: 600, r: 26 };

function drawPage(ctx: Ctx, offset: number) {
  const { y, m, today } = monthOf(offset), t = THEMES[m - 1];
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, CW, CH);
  // the holes the wire goes through
  ctx.fillStyle = "#3a3633";
  for (const x of HOLES) {
    ctx.beginPath();
    ctx.ellipse(x, HOLE_Y, 7, 10, 0, 0, TAU);
    ctx.fill();
  }
  // the picture
  ctx.save();
  rrect(ctx, PIC.x, PIC.y, PIC.w, PIC.h, PIC.r);
  ctx.clip();
  ctx.translate(PIC.x, PIC.y);
  landscape(ctx, PIC.w, PIC.h, t, y * 12 + m);
  ctx.restore();
  // the month in its colour, the year, and a line for the month
  const L = 56, R = CW - 56;
  ctx.textAlign = "left";
  ctx.fillStyle = t.accent;
  ctx.font = `800 104px ${FONT.display()}`;
  ctx.fillText(monthName(y, m), L, 812);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.font = `700 60px ${FONT.display()}`;
  ctx.fillText(String(y), R, 806);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(43,38,34,.78)";
  ctx.font = `400 50px ${FONT.hand()}`;
  ctx.fillText(t.caption, L + 4, 874);
  // the week, Monday first as a Vietnamese calendar has it, on a band of the month's colour
  const colW = (R - L) / 7;
  ctx.fillStyle = rgba(t.accent, 0.14);
  rrect(ctx, L, 908, R - L, 64, 32);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = `700 32px ${FONT.mono()}`;
  ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].forEach((d, i) => {
    ctx.fillStyle = i === 6 ? SUN_RED : i === 5 ? SAT_BLUE : INK;
    ctx.fillText(d, L + colW * (i + 0.5), 952);
  });
  // the days: Saturdays blue, Sundays red, today ringed, a little star on the days worth one
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rowH = first + n > 35 ? 72 : 86, mk = marks(y, m);
  for (let d = 1; d <= n; d++) {
    const cell = first + d - 1, col = cell % 7, cx = L + colW * (col + 0.5), cy = 1044 + Math.floor(cell / 7) * rowH;
    if (d === today) disc(ctx, cx, cy - 16, 38, t.accent);
    ctx.fillStyle = d === today ? "#ffffff" : col === 6 ? SUN_RED : col === 5 ? SAT_BLUE : INK;
    ctx.font = `${d === today ? 800 : 600} 46px ${FONT.display()}`;
    ctx.fillText(String(d), cx, cy);
    const k = mk.get(d);
    if (!k) continue;
    if (k === "heart") heartPath(ctx, cx + 36, cy - 44, 11);
    else starPath(ctx, cx + 36, cy - 44, 12);
    ctx.fillStyle = k === "heart" ? "#ef476f" : "#f2b705";
    ctx.fill();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(43,38,34,.55)";
  ctx.font = `400 26px ${FONT.mono()}`;
  ctx.fillText("Sài Gòn · GMT+7", L, CH - 26);
}

// ---------------------------------------------------------------- the calendar
const MONTHS = 12;
/** local z: the wall is 5 mm behind; the backing board, the pad of pages, then the page on top */
const Z = { board: -0.0015, pad: 0.0025, face: 0.0051, flip: 0.0056, wire: 0.0022 };
const TOP = PAGE.h / 2, PIVOT = TOP - HOLE_Y / PX;

/** the double loops of wire through the holes, in one geometry */
function wireGeometry() {
  const loops = HOLES.flatMap((px) => [-0.0012, 0.0012].map((dx) => {
    const g = new THREE.TorusGeometry(0.0062, 0.00055, 6, 18);
    g.rotateY(Math.PI / 2);
    g.translate((px - CW / 2) / PX + dx, PIVOT + 0.004, Z.wire);
    return g;
  }));
  // the hanger: a bent wire from the binding up to the nail
  const hook = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.016, TOP + 0.002, Z.wire),
    new THREE.Vector3(-0.005, TOP + 0.028, Z.wire - 0.001),
    new THREE.Vector3(0, TOP + 0.0334, 0),
    new THREE.Vector3(0.005, TOP + 0.028, Z.wire - 0.001),
    new THREE.Vector3(0.016, TOP + 0.002, Z.wire),
  ]), 24, 0.0007, 5, false);
  return mergeGeometries([...loops, hook])!;
}

export function Calendar() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => { registerStation("calendar", ref.current); return () => registerStation("calendar", null); }, []);
  const face = useMemo(() => canvasTexture(CW, CH, (ctx) => drawPage(ctx, 0), { anisotropy: 16 }), []);
  const flip = useMemo(() => canvasTexture(CW, CH, undefined, { anisotropy: 16 }), []);
  const m = useMemo(() => ({
    // a touch of its own light, so the colours read on a wall the sun doesn't reach
    face: new THREE.MeshStandardMaterial({ map: face.texture, roughness: 0.82, emissive: "#ffffff", emissiveMap: face.texture, emissiveIntensity: 0.24 }),
    // the turning page is lit just like the one under it, and its back is plain paper
    flip: new THREE.MeshStandardMaterial({ map: flip.texture, roughness: 0.82, emissive: "#ffffff", emissiveMap: flip.texture, emissiveIntensity: 0.24 }),
    back: new THREE.MeshStandardMaterial({ color: "#efeae0", roughness: 0.9, emissive: "#efeae0", emissiveIntensity: 0.12, side: THREE.BackSide }),
    pad: new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.9 }),
    board: new THREE.MeshStandardMaterial({ color: "#cfc6b6", roughness: 0.95 }),
    wire: new THREE.MeshStandardMaterial({ color: "#c7c9cc", roughness: 0.3, metalness: 0.9 }),
    nail: new THREE.MeshStandardMaterial({ color: "#8d8f93", roughness: 0.35, metalness: 0.85 }),
  }), [face, flip]);
  const wire = useMemo(wireGeometry, []);

  // `t` runs while a page is turning; `dir` is which way (+1 up and over to the next month, -1 back down)
  const st = useRef({ offset: 0, t: -1, dir: 1 });
  const page = useRef<THREE.Group>(null);
  const turn = useMemo(() => {
    const settle = () => {
      const s = st.current, g = page.current;
      if (s.t < 0) return;
      if (s.dir < 0) { drawPage(face.ctx, s.offset); face.texture.needsUpdate = true; }
      s.t = -1;
      if (g) { g.visible = false; g.rotation.x = 0; g.scale.y = 1; }
    };
    const go = (d: 1 | -1) => {
      settle();
      const s = st.current, to = d > 0 ? (s.offset + 1) % MONTHS : s.offset - 1;
      if (to < 0) return;
      if (d > 0) {
        // the page goes up over the wire and the next month is underneath
        drawPage(flip.ctx, s.offset); flip.texture.needsUpdate = true;
        drawPage(face.ctx, to); face.texture.needsUpdate = true;
      } else {
        // last month comes back down over this one
        drawPage(flip.ctx, to); flip.texture.needsUpdate = true;
      }
      Object.assign(s, { offset: to, dir: d, t: 0 });
    };
    return { go, settle };
  }, [face, flip]);

  useEffect(() => {
    // the handwriting and display faces may arrive after the first paint
    fontsReady().then(() => { drawPage(face.ctx, st.current.offset); face.texture.needsUpdate = true; });
    // dev hook: any month's page as an image, for checking the drawing
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __calendarPage: (o: number) => string }).__calendarPage = (o) => {
        const c = document.createElement("canvas");
        c.width = CW;
        c.height = CH;
        drawPage(c.getContext("2d")!, o);
        return c.toDataURL("image/png");
      };
    }
  }, [face]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useRoom.getState().page !== "calendar" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      turn.go(e.key === "ArrowRight" ? 1 : -1);
      // a label still showing names the month that was next
      if (useRoom.getState().hover?.startsWith("CALENDAR")) useRoom.getState().setHover(label());
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [turn]);

  useFrame((_, dt) => {
    const s = st.current, g = page.current;
    if (!g || s.t < 0) return;
    s.t += dt;
    // the page swings up and over the wire, then folds down out of sight behind it (going back, the other way round)
    const k = Math.min(1, s.t / 0.95), lift = s.dir > 0 ? k : 1 - k, sw = Math.min(1, lift / 0.82), e = sw * sw * (3 - 2 * sw);
    g.rotation.x = -e * Math.PI * 0.96;
    g.scale.y = 1 - Math.max(0, (lift - 0.82) / 0.18);
    g.visible = g.scale.y > 0.002;
    if (k >= 1) turn.settle();
  });

  // a click from across the room comes over to look; up close, a click turns the page
  const act = () => {
    const s = useRoom.getState();
    if (s.page !== "calendar") return s.go("calendar");
    turn.go(1);
    s.setHover(label());
  };
  function label() {
    if (useRoom.getState().page !== "calendar") return "CALENDAR · LOOK CLOSER";
    const o = st.current.offset, to = monthOf(o === MONTHS - 1 ? 0 : o + 1);
    return `CALENDAR · ${o === MONTHS - 1 ? "BACK TO" : "ON TO"} ${monthName(to.y, to.m).toUpperCase()}`;
  }

  return (
    <group ref={ref} position={[0.85, 1.5, ROOM.z1 - 0.005]} rotation-y={Math.PI} {...clickable(label, act)}>
      {/* the nail it hangs from */}
      <mesh position={[0, TOP + 0.031, 0.002]} rotation-x={Math.PI / 2} castShadow material={m.nail}><cylinderGeometry args={[0.0016, 0.0016, 0.016, 8]} /></mesh>
      <mesh position={[0, TOP + 0.031, 0.0105]} rotation-x={Math.PI / 2} castShadow material={m.nail}><cylinderGeometry args={[0.0042, 0.0042, 0.0012, 16]} /></mesh>
      <mesh position={[0, 0, Z.board]} castShadow receiveShadow material={m.board}><boxGeometry args={[PAGE.w, PAGE.h, 0.003]} /></mesh>
      <mesh position={[0, -0.0005, Z.pad]} castShadow receiveShadow material={m.pad}><boxGeometry args={[PAGE.w - 0.001, PAGE.h - 0.001, 0.005]} /></mesh>
      <mesh position={[0, 0, Z.face]} receiveShadow material={m.face}><planeGeometry args={[PAGE.w, PAGE.h]} /></mesh>
      <mesh geometry={wire} castShadow material={m.wire} />
      <group ref={page} position={[0, PIVOT, Z.flip]} visible={false}>
        {/* in the room's shadows like the page under it, or it would catch sun the wall never gets */}
        <mesh position={[0, -PIVOT, 0]} castShadow receiveShadow material={m.flip}><planeGeometry args={[PAGE.w, PAGE.h]} /></mesh>
        <mesh position={[0, -PIVOT, 0]} castShadow receiveShadow material={m.back}><planeGeometry args={[PAGE.w, PAGE.h]} /></mesh>
      </group>
    </group>
  );
}
