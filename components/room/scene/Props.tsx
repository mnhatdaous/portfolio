"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { profile } from "@/content/profile";
import { sound } from "../lib/audio";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng } from "../lib/textures";
import { useRoom } from "../store";
import { DESK_Y } from "./Desk";
import { WIN } from "./Room";

// The things that only do something small when clicked. They're what make the room feel lived in.

// ---------------------------------------------------------------- cà phê sữa đá, with its phin
const GLASS = new THREE.Vector3(-0.27, DESK_Y, -0.02);
const SAUCER = new THREE.Vector3(-0.39, DESK_Y, 0.07);
const CARAMEL = new THREE.Color("#a26f3e");

export function Coffee() {
  const st = useRef({ phase: "brew" as "brew" | "stir" | "empty", level: 1, mix: 0, phinK: 0, emptyAt: 0, drip: 0 });
  const m = useMemo(() => ({
    glass: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    glassBase: new THREE.MeshStandardMaterial({ color: "#dfe9ea", transparent: true, opacity: 0.4, roughness: 0.1 }),
    milk: new THREE.MeshStandardMaterial({ color: "#e8dabd", roughness: 0.3 }),
    coffee: new THREE.MeshStandardMaterial({ color: "#2a160b", roughness: 0.15 }),
    ice: new THREE.MeshStandardMaterial({ color: "#eef6fb", transparent: true, opacity: 0.55, roughness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.28, metalness: 0.85 }),
    ceramic: new THREE.MeshStandardMaterial({ color: "#f1ece2", roughness: 0.35 }),
  }), []);
  const milkC = useMemo(() => m.milk.color.clone(), [m]);
  const coffeeC = useMemo(() => m.coffee.color.clone(), [m]);
  const iceGeo = useMemo(() => new RoundedBoxGeometry(0.019, 0.017, 0.019, 2, 0.004), []);
  const liquid = useRef<THREE.Group>(null);
  const phin = useRef<THREE.Group>(null);
  const drop = useRef<THREE.Mesh>(null);
  const ices = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }, dt) => {
    const s = st.current, T = clock.elapsedTime;
    s.mix += ((s.phase === "brew" ? 0 : 1) - s.mix) * Math.min(1, dt * (s.phase === "brew" ? 3 : 1.6));
    s.phinK += ((s.phase === "brew" ? 0 : 1) - s.phinK) * Math.min(1, dt * 4);
    // an empty glass is refilled after a while
    if (s.phase === "empty") {
      if (s.emptyAt < 0) s.emptyAt = T;
      else if (T - s.emptyAt > 6) { s.phase = "brew"; s.level = 1; }
    }
    const lvl = s.phase === "brew" ? 1 : s.level;
    if (liquid.current) liquid.current.scale.y += (Math.max(0.02, lvl) - liquid.current.scale.y) * Math.min(1, dt * 3);
    m.milk.color.copy(milkC).lerp(CARAMEL, s.mix);
    m.coffee.color.copy(coffeeC).lerp(CARAMEL, s.mix);
    if (phin.current) {
      // lifted off the glass and set down on the saucer, in a small arc
      const k = s.phinK;
      phin.current.position.set(
        THREE.MathUtils.lerp(GLASS.x, SAUCER.x, k),
        THREE.MathUtils.lerp(GLASS.y + 0.112, SAUCER.y + 0.006, k) + Math.sin(k * Math.PI) * 0.06,
        THREE.MathUtils.lerp(GLASS.z, SAUCER.z, k),
      );
    }
    if (drop.current) {
      s.drip = (s.drip + dt * 1.25) % 1;
      const on = s.phase === "brew";
      drop.current.visible = on && s.drip < 0.7;
      drop.current.position.y = GLASS.y + 0.105 - (s.drip / 0.7) * 0.03;
    }
    const top = 0.0045 + 0.09 * (liquid.current?.scale.y ?? 1);
    ices.current.forEach((o, i) => {
      if (!o) return;
      o.visible = (liquid.current?.scale.y ?? 1) > 0.15;
      o.position.y = GLASS.y + top - 0.006 + Math.sin(T * 1.3 + i * 2) * 0.0015;
    });
  });

  const label = () => {
    const p = st.current.phase;
    return p === "brew" ? "CÀ PHÊ SỮA ĐÁ · STIR" : p === "stir" ? "CÀ PHÊ SỮA ĐÁ · SIP" : "CÀ PHÊ SỮA ĐÁ · ONE MORE";
  };
  const act = () => {
    const s = st.current;
    if (s.phase === "brew") s.phase = "stir";
    else if (s.phase === "stir") {
      s.level -= 0.26;
      if (s.level <= 0.08) { s.level = 0; s.phase = "empty"; s.emptyAt = -1; }
    } else { s.phase = "brew"; s.level = 1; }
  };

  return (
    <group {...clickable(label, act)}>
      <group position={GLASS}>
        <mesh position={[0, 0.055, 0]} material={m.glass}><cylinderGeometry args={[0.036, 0.031, 0.11, 32, 1, true]} /></mesh>
        <mesh position={[0, 0.0045, 0]} castShadow material={m.glassBase}><cylinderGeometry args={[0.031, 0.031, 0.009, 32]} /></mesh>
        <group ref={liquid} position={[0, 0.009, 0]}>
          <mesh position={[0, 0.0125, 0]} material={m.milk}><cylinderGeometry args={[0.0315, 0.0295, 0.025, 28]} /></mesh>
          <mesh position={[0, 0.0575, 0]} material={m.coffee}><cylinderGeometry args={[0.0335, 0.0315, 0.065, 28]} /></mesh>
        </group>
        {[[-0.009, 0.006, 0.4], [0.01, -0.004, 1.2], [0.0, 0.012, 2.3]].map(([x, z, r], i) => (
          <mesh key={i} ref={(o) => { ices.current[i] = o; }} geometry={iceGeo} position={[x, 0.09, z]} rotation={[r, r * 1.7, 0]} material={m.ice} />
        ))}
      </group>
      <mesh ref={drop} position={[GLASS.x, GLASS.y + 0.1, GLASS.z]} material={m.coffee}><sphereGeometry args={[0.0028, 8, 6]} /></mesh>
      <mesh position={[SAUCER.x, SAUCER.y + 0.003, SAUCER.z]} castShadow receiveShadow material={m.ceramic}><cylinderGeometry args={[0.055, 0.045, 0.006, 32]} /></mesh>
      <group ref={phin} position={[GLASS.x, GLASS.y + 0.112, GLASS.z]}>
        <mesh position={[0, 0.002, 0]} castShadow material={m.metal}><cylinderGeometry args={[0.049, 0.049, 0.004, 32]} /></mesh>
        <mesh position={[0, 0.029, 0]} castShadow material={m.metal}><cylinderGeometry args={[0.038, 0.035, 0.05, 32, 1, true]} /></mesh>
        <mesh position={[0, 0.057, 0]} castShadow material={m.metal}><cylinderGeometry args={[0.041, 0.041, 0.006, 32]} /></mesh>
        <mesh position={[0, 0.066, 0]} castShadow material={m.metal}><sphereGeometry args={[0.008, 12, 8]} /></mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- a pothos on the sill, trailing toward the desk
function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.03, 0.006, 0.04, 0.045, 0, 0.07);
  s.bezierCurveTo(-0.04, 0.045, -0.03, 0.006, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

export function Plant() {
  const pot = new THREE.Vector3(0.86, WIN.y0 + 0.026, -0.55);
  const leaf = useMemo(leafShape, []);
  const greens = useMemo(() => ["#3f7d3a", "#4f8f3f", "#5f9b43", "#3a6e34"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide })), []);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#b0603e", roughness: 0.85 }),
    soil: new THREE.MeshStandardMaterial({ color: "#2b1d14", roughness: 1 }),
  }), []);
  // leaves: a bushy top, and three vines over the sill's edge
  const leaves = useMemo(() => {
    const r = rng(23), out: { p: [number, number, number]; rot: [number, number, number]; s: number; c: number; vine: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.06;
      out.push({ p: [Math.cos(a) * d, 0.11 + r() * 0.08, Math.sin(a) * d], rot: [-0.5 - r() * 0.8, a, (r() - 0.5) * 0.8], s: 0.9 + r() * 0.5, c: Math.floor(r() * 4), vine: -1 });
    }
    for (let v = 0; v < 3; v++) {
      const x0 = (v - 1) * 0.05;
      for (let k = 0; k < 6; k++) {
        const t = k / 5;
        out.push({ p: [x0 + Math.sin(k + v) * 0.02, 0.08 - t * 0.27, 0.07 + Math.min(t, 0.4) * 0.12], rot: [0.9 + r() * 0.5, (r() - 0.5) * 1.5, (r() - 0.5) * 0.8], s: 0.75 + r() * 0.3, c: Math.floor(r() * 4), vine: v });
      }
    }
    return out;
  }, []);
  const group = useRef<THREE.Group>(null);
  const rustle = useRef(0);
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    rustle.current = Math.max(0, rustle.current - dt * 0.8);
    const fan = useRoom.getState().fan, T = clock.elapsedTime;
    const amp = 0.012 + fan * 0.012 + rustle.current * 0.12;
    g.children.forEach((c, i) => {
      if (!c.userData.leaf) return;
      c.rotation.z = c.userData.rz + Math.sin(T * (2.2 + (i % 5) * 0.4) + i) * amp;
    });
  });
  return (
    <group position={pot} {...clickable("POTHOS · RUSTLE", () => { rustle.current = 1; })}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow material={m.pot}><cylinderGeometry args={[0.065, 0.048, 0.1, 24]} /></mesh>
      <mesh position={[0, 0.097, 0]} material={m.soil}><cylinderGeometry args={[0.06, 0.06, 0.006, 24]} /></mesh>
      <group ref={group}>
        {leaves.map((l, i) => (
          <mesh
            key={i}
            geometry={leaf}
            material={greens[l.c]}
            position={l.p}
            rotation={l.rot}
            scale={l.s}
            castShadow
            userData={{ leaf: true, rz: l.rot[2] }}
          />
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- the wall fan
export function Fan() {
  const head = useRef<THREE.Group>(null);
  const blades = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const m = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: "#e6e0d2", roughness: 0.45 }),
    cage: new THREE.MeshStandardMaterial({ color: "#d9d4c8", roughness: 0.35, metalness: 0.5 }),
    blade: new THREE.MeshStandardMaterial({ color: "#5aa6e8", roughness: 0.3, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    badge: new THREE.MeshStandardMaterial({ color: "#2f6fb5", roughness: 0.4 }),
  }), []);
  const blade = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0.02, -0.02);
    s.bezierCurveTo(0.09, -0.07, 0.17, -0.04, 0.16, 0.03);
    s.bezierCurveTo(0.15, 0.07, 0.07, 0.05, 0.02, 0.02);
    s.closePath();
    return new THREE.ShapeGeometry(s, 8);
  }, []);
  useEffect(() => useRoom.subscribe((s, p) => { if (s.fan !== p.fan) sound.setFan(s.fan); }), []);
  useFrame(({ clock }, dt) => {
    const fan = useRoom.getState().fan, T = clock.elapsedTime;
    spin.current += ([0, 9, 15, 22][fan] - spin.current) * Math.min(1, dt * (fan ? 1.2 : 0.5));
    if (blades.current) blades.current.rotation.z -= spin.current * dt;
    if (head.current && fan) head.current.rotation.y = Math.sin(T * 0.45) * 0.6;
  });
  const label = () => { const f = useRoom.getState().fan; return f ? `FAN · SPEED ${f}` : "FAN · OFF"; };
  return (
    <group position={[1.42, 2.12, -0.5]} {...clickable(label, () => useRoom.getState().cycleFan())}>
      <mesh position={[0, 0, 0.03]} castShadow material={m.body}><boxGeometry args={[0.07, 0.1, 0.06]} /></mesh>
      <group ref={head} position={[0, 0, 0.06]}>
        <group rotation-x={0.28}>
          <mesh position={[0, 0, 0.05]} rotation-x={Math.PI / 2} castShadow material={m.body}><cylinderGeometry args={[0.055, 0.06, 0.12, 24]} /></mesh>
          <mesh position={[0, 0, -0.01]} castShadow material={m.body}><sphereGeometry args={[0.058, 20, 14]} /></mesh>
          <group position={[0, 0, 0.18]}>
            <mesh material={m.cage}><torusGeometry args={[0.2, 0.004, 6, 64]} /></mesh>
            <mesh position={[0, 0, -0.07]} material={m.cage}><torusGeometry args={[0.19, 0.003, 6, 64]} /></mesh>
            {Array.from({ length: 18 }, (_, i) => (
              <mesh key={i} rotation-z={(i / 18) * Math.PI * 2} position={[0, 0, 0.002]} material={m.cage}>
                <boxGeometry args={[0.4, 0.003, 0.003]} />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.006]} rotation-x={Math.PI / 2} material={m.badge}><cylinderGeometry args={[0.035, 0.035, 0.008, 24]} /></mesh>
            <group ref={blades} position={[0, 0, -0.035]}>
              {[0, 1, 2].map((k) => <mesh key={k} geometry={blade} rotation-z={(k / 3) * Math.PI * 2} material={m.blade} />)}
              <mesh rotation-x={Math.PI / 2} material={m.body}><cylinderGeometry args={[0.03, 0.03, 0.03, 20]} /></mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- the floor lamp by the bookshelf
export function FloorLamp() {
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(1);
  const m = useMemo(() => ({
    metal: new THREE.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.4, metalness: 0.7 }),
    shade: new THREE.MeshStandardMaterial({ color: "#efe2c6", emissive: new THREE.Color("#ffcf96"), emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe2b8").multiplyScalar(4) }),
  }), []);
  useFrame((_, dt) => {
    const on = useRoom.getState().floorLamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 14 : 5));
    if (light.current) light.current.intensity = 2.4 * k.current;
    m.shade.emissiveIntensity = 0.55 * k.current;
    m.bulb.color.setRGB(1, 0.886, 0.722).multiplyScalar(4 * k.current + 0.05);
  });
  const label = () => (useRoom.getState().floorLamp ? "FLOOR LAMP · SWITCH OFF" : "FLOOR LAMP · SWITCH ON");
  return (
    <group position={[1.62, 0, 1.78]} {...clickable(label, () => useRoom.getState().toggleFloorLamp())}>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow material={m.metal}><cylinderGeometry args={[0.15, 0.17, 0.024, 32]} /></mesh>
      <mesh position={[0, 0.78, 0]} castShadow material={m.metal}><cylinderGeometry args={[0.011, 0.011, 1.52, 10]} /></mesh>
      <mesh position={[0, 1.62, 0]} material={m.shade}><cylinderGeometry args={[0.17, 0.21, 0.3, 32, 1, true]} /></mesh>
      <mesh position={[0, 1.58, 0]} material={m.bulb}><sphereGeometry args={[0.03, 12, 10]} /></mesh>
      <pointLight ref={light} position={[0, 1.55, 0]} color="#ffd6a3" intensity={2.4} distance={4.8} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------- lịch bloc: the tear-off calendar
const day = (offset: number) => new Date(Date.now() + offset * 86400000);
function drawDay(ctx: CanvasRenderingContext2D, offset: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height, d = day(offset), tz = profile.timeZone;
  const num = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric" }).format(d);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "numeric" }).format(d);
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric" }).format(d);
  const wd = new Intl.DateTimeFormat("vi-VN", { timeZone: tz, weekday: "long" }).format(d).toLocaleUpperCase("vi");
  const sunday = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(d) === "Sun";
  const red = "#c4161c", ink = sunday ? red : "#1f3f8a";
  ctx.fillStyle = "#fbf8f1";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = red;
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = "#fff4d6";
  ctx.font = `700 28px ${FONT.display()}`;
  ctx.textAlign = "center";
  ctx.fillText(`THÁNG ${month} · ${year}`, W / 2, 38);
  ctx.fillStyle = ink;
  ctx.font = `800 190px ${FONT.display()}`;
  ctx.fillText(num, W / 2, 238);
  ctx.font = `700 34px ${FONT.display()}`;
  ctx.fillText(wd, W / 2, 292);
  ctx.fillStyle = "rgba(30,30,40,.55)";
  ctx.font = `400 20px ${FONT.mono()}`;
  ctx.fillText("Sài Gòn", W / 2, 330);
  ctx.textAlign = "left";
}

function drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#b3171d");
  g.addColorStop(1, "#7c0d12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#e3b04b";
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, w - 44, h - 44);
  ctx.fillStyle = "#f1c25a";
  ctx.textAlign = "center";
  ctx.font = `800 64px ${FONT.display()}`;
  ctx.fillText("2026", w / 2, 92);
  ctx.font = `700 26px ${FONT.display()}`;
  ctx.fillText("BÍNH NGỌ", w / 2, 128);
  ctx.textAlign = "left";
}

export function Calendar() {
  const pad = useMemo(() => canvasTexture(300, 350, (ctx) => drawDay(ctx, 0)), []);
  const torn = useMemo(() => canvasTexture(300, 350, (ctx) => drawDay(ctx, 0)), []);
  const board = useMemo(() => canvasTexture(300, 440, drawBoard), []);
  const st = useRef({ offset: 0, tearT: -1 });
  const page = useRef<THREE.Group>(null);
  useEffect(() => {
    fontsReady().then(() => {
      drawDay(pad.ctx, st.current.offset); pad.texture.needsUpdate = true;
      drawBoard(board.ctx, 300, 440); board.texture.needsUpdate = true;
    });
  }, [pad, board]);
  const m = useMemo(() => ({
    board: new THREE.MeshStandardMaterial({ map: board.texture, roughness: 0.6 }),
    pad: new THREE.MeshStandardMaterial({ map: pad.texture, roughness: 0.85 }),
    torn: new THREE.MeshStandardMaterial({ map: torn.texture, roughness: 0.85, transparent: true, side: THREE.DoubleSide }),
    edge: new THREE.MeshStandardMaterial({ color: "#efe9dc", roughness: 0.9 }),
  }), [board, pad, torn]);

  useFrame((_, dt) => {
    const s = st.current, g = page.current;
    if (!g) return;
    if (s.tearT < 0) { g.visible = false; return; }
    s.tearT += dt;
    const k = Math.min(1, s.tearT / 1.1);
    g.visible = k < 1;
    g.rotation.x = k * 1.7;
    g.position.y = 0.0425 - k * k * 0.5;
    g.position.z = 0.012 + k * 0.12;
    m.torn.opacity = 1 - k * k;
    if (k >= 1) s.tearT = -1;
  });

  const tear = () => {
    const s = st.current;
    drawDay(torn.ctx, s.offset); torn.texture.needsUpdate = true;
    s.offset = (s.offset + 1) % 4; // after a few days, back to today
    drawDay(pad.ctx, s.offset); pad.texture.needsUpdate = true;
    s.tearT = 0;
  };

  return (
    <group position={[-0.98, 1.6, -0.495]} {...clickable("LỊCH BLOC · TEAR OFF A DAY", tear)}>
      <mesh material={m.board} castShadow><planeGeometry args={[0.3, 0.44]} /></mesh>
      <mesh position={[0, -0.075, 0.011]} castShadow material={m.edge}><boxGeometry args={[0.2, 0.235, 0.02]} /></mesh>
      <mesh position={[0, -0.075, 0.0215]} material={m.pad}><planeGeometry args={[0.2, 0.235]} /></mesh>
      {/* the page being torn off turns about its top edge */}
      <group ref={page} position={[0, 0.0425, 0.023]}>
        <mesh position={[0, -0.1175, 0]} material={m.torn}><planeGeometry args={[0.2, 0.235]} /></mesh>
      </group>
    </group>
  );
}
