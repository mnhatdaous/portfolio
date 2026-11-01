"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { jobs, profile } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, roundRect } from "../lib/textures";
import { useRoom } from "../store";
import { DESK_Y } from "./Desk";

const SW = 1024, SH = 640;
const TZ = profile.timeZone;
export const saigonTime = (d = new Date()) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const saigonDate = (d = new Date()) => new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);

// what the terminal types at About: commands type out, their output appears line by line
const COLS = 62;
const wrapCols = (s: string) => {
  const out: string[] = [];
  let line = "";
  for (const w of s.split(" ")) {
    if ((line + " " + w).trim().length > COLS && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  out.push(line);
  return out;
};
const SCRIPT: { cmd: string; out: string[] }[] = [
  { cmd: "whoami", out: [`${profile.name} · ${profile.role}`, profile.location] },
  { cmd: "cat about.txt", out: [...wrapCols(profile.about[0]), ...wrapCols(profile.about[1])] },
  { cmd: "ls work/", out: [jobs.map((j) => `${j.id}/`).join("  ")] },
  { cmd: "cat education.txt", out: [profile.education.school, `Bachelor's, Information Technology · ${profile.education.years}`] },
];
const PROMPT = "nhat@saigon ~ % ";
const TYPE_CPS = 30, LINE_GAP = 0.07, PAUSE = 0.45;

/** the lines visible `t` seconds into the session, and whether the last one is still being typed */
function termAt(t: number) {
  const lines: { kind: "cmd" | "out"; text: string }[] = [];
  let clock = 0.3;
  for (const step of SCRIPT) {
    const typed = Math.floor((t - clock) * TYPE_CPS);
    if (typed < 0) { lines.push({ kind: "cmd", text: "" }); return { lines, typing: false }; }
    if (typed < step.cmd.length) { lines.push({ kind: "cmd", text: step.cmd.slice(0, typed) }); return { lines, typing: true }; }
    lines.push({ kind: "cmd", text: step.cmd });
    clock += step.cmd.length / TYPE_CPS + 0.25;
    for (const o of step.out) {
      if (t < clock) return { lines, typing: false };
      lines.push({ kind: "out", text: o });
      clock += LINE_GAP;
    }
    lines.push({ kind: "out", text: "" });
    clock += PAUSE;
  }
  lines.push({ kind: "cmd", text: "" });
  return { lines, typing: false };
}

function drawLock(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, "#1d1533");
  g.addColorStop(1, "#0b1a28");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  for (const [x, y, r, c] of [[160, 90, 420, "rgba(255,80,140,.28)"], [880, 560, 460, "rgba(60,220,210,.22)"]] as const) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, SW, SH);
  }
  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % SW, y = (i * 53) % SH;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 46); ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4eee2";
  ctx.font = `800 168px ${FONT.display()}`;
  ctx.fillText(saigonTime(), SW / 2, 262);
  ctx.font = `500 34px ${FONT.display()}`;
  ctx.fillStyle = "rgba(244,238,226,.85)";
  const date = saigonDate();
  ctx.fillText(date.charAt(0).toUpperCase() + date.slice(1), SW / 2, 318);
  // the account
  ctx.fillStyle = "rgba(255,255,255,.14)";
  ctx.beginPath(); ctx.arc(SW / 2, 452, 44, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f4eee2";
  ctx.font = `700 40px ${FONT.display()}`;
  ctx.fillText(profile.short.charAt(0), SW / 2, 466);
  ctx.font = `700 30px ${FONT.display()}`;
  ctx.fillText(profile.name, SW / 2, 538);
  ctx.font = `400 21px ${FONT.mono()}`;
  ctx.fillStyle = "rgba(244,238,226,.6)";
  ctx.fillText("click to open · about", SW / 2, 586);
  ctx.textAlign = "left";
}

function drawTerm(ctx: CanvasRenderingContext2D, t: number, blink: boolean) {
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, SW, SH);
  // title bar
  ctx.fillStyle = "#22252d";
  ctx.fillRect(0, 0, SW, 46);
  for (const [i, c] of ["#ff5f57", "#febc2e", "#28c840"].entries()) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(28 + i * 26, 23, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#8d919c";
  ctx.font = `500 19px ${FONT.mono()}`;
  ctx.textAlign = "center";
  ctx.fillText("nhat — zsh — 80×24", SW / 2, 30);
  ctx.textAlign = "left";
  const { lines, typing } = termAt(t);
  const LH = 31, max = Math.floor((SH - 70) / LH), from = Math.max(0, lines.length - max);
  ctx.font = `400 24px ${FONT.mono()}`;
  let y = 84;
  lines.slice(from).forEach((l, i, arr) => {
    let x = 30;
    if (l.kind === "cmd") {
      ctx.fillStyle = "#7ee787"; ctx.fillText("nhat@saigon", x, y); x += ctx.measureText("nhat@saigon").width;
      ctx.fillStyle = "#79c0ff"; ctx.fillText(" ~ ", x, y); x += ctx.measureText(" ~ ").width;
      ctx.fillStyle = "#e6e1d6"; ctx.fillText("% " + l.text, x, y); x += ctx.measureText("% " + l.text).width;
      if (i === arr.length - 1 && (typing || blink)) { ctx.fillStyle = "#ffb35a"; ctx.fillRect(x + 2, y - 21, 13, 27); }
    } else {
      ctx.fillStyle = "#c9c2b4"; ctx.fillText(l.text, x, y);
    }
    y += LH;
  });
}

export default function Laptop() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => { registerStation("about", ref.current); return () => registerStation("about", null); }, []);

  const screen = useMemo(() => canvasTexture(SW, SH), []);
  const m = useMemo(() => {
    const keys = canvasTexture(512, 220, (ctx, w, h) => {
      ctx.fillStyle = "#1b1c21"; ctx.fillRect(0, 0, w, h);
      const rows = [14, 14, 13, 12, 11], kw = 31, gap = 4.6;
      rows.forEach((n, r) => {
        const y = 10 + r * 36, x0 = (w - (n * kw + (n - 1) * gap)) / 2;
        for (let i = 0; i < n; i++) { ctx.fillStyle = "#2c2e36"; roundRect(ctx, x0 + i * (kw + gap), y, kw, 30, 4); ctx.fill(); }
      });
      ctx.fillStyle = "#2c2e36"; roundRect(ctx, 150, 190, 212, 24, 4); ctx.fill();
    }).texture;
    const scr = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: true });
    scr.color.setScalar(1.12);
    return {
      shell: new THREE.MeshStandardMaterial({ color: "#a9aeb8", roughness: 0.32, metalness: 0.65 }),
      keys: new THREE.MeshStandardMaterial({ map: keys, roughness: 0.6 }),
      pad: new THREE.MeshStandardMaterial({ color: "#9a9fa9", roughness: 0.25, metalness: 0.5 }),
      bezel: new THREE.MeshStandardMaterial({ color: "#0c0d10", roughness: 0.3 }),
      screen: scr,
    };
  }, [screen]);
  const geo = useMemo(() => ({
    base: new RoundedBoxGeometry(0.31, 0.014, 0.215, 2, 0.005),
    lid: new RoundedBoxGeometry(0.31, 0.205, 0.007, 2, 0.003),
  }), []);

  const st = useRef({ mode: "", key: "", openedAt: 0, ready: false });
  useEffect(() => { fontsReady().then(() => { st.current.ready = true; st.current.key = ""; }); }, []);

  useFrame(({ clock }) => {
    const s = st.current, T = clock.elapsedTime;
    const about = useRoom.getState().page === "about";
    const mode = about ? "term" : "lock";
    if (mode !== s.mode) { s.mode = mode; s.openedAt = T; s.key = ""; }
    // redraw only when something on the screen changed
    let key: string;
    if (mode === "lock") key = saigonTime() + s.ready;
    else {
      const t = T - s.openedAt, blink = Math.floor(T * 1.9) % 2 === 0;
      key = `${termAt(t).lines.reduce((n, l) => n + l.text.length + 1, 0)}|${blink}|${s.ready}`;
      if (key !== s.key) drawTerm(screen.ctx, t, blink);
    }
    if (key === s.key) return;
    if (mode === "lock") drawLock(screen.ctx);
    s.key = key;
    screen.texture.needsUpdate = true;
  });

  return (
    <group ref={ref} position={[0.17, DESK_Y, -0.19]} rotation-y={-0.05} {...clickable("LAPTOP · ABOUT", () => useRoom.getState().go("about"))}>
      <mesh geometry={geo.base} position={[0, 0.007, 0]} castShadow receiveShadow material={m.shell} />
      <mesh position={[0, 0.0142, -0.025]} rotation-x={-Math.PI / 2} material={m.keys}><planeGeometry args={[0.272, 0.112]} /></mesh>
      <mesh position={[0, 0.0142, 0.068]} rotation-x={-Math.PI / 2} material={m.pad}><planeGeometry args={[0.105, 0.062]} /></mesh>
      <group position={[0, 0.014, -0.104]} rotation-x={-0.27}>
        <mesh geometry={geo.lid} position={[0, 0.1025, -0.0036]} castShadow material={m.shell} />
        <mesh position={[0, 0.1025, 0.0001]} material={m.bezel}><planeGeometry args={[0.302, 0.197]} /></mesh>
        <mesh position={[0, 0.1045, 0.0003]} material={m.screen}><planeGeometry args={[0.284, 0.1775]} /></mesh>
        <pointLight position={[0, 0.1, 0.16]} color="#a9c1ff" intensity={0.35} distance={1.2} decay={2} />
      </group>
    </group>
  );
}
