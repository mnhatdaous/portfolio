"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { profile } from "@/content/profile";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng } from "../lib/textures";
import { useRoom } from "../store";
import { saigonTime } from "./Computer";
import { DESK_Y } from "./Desk";
import { ROOM } from "./Room";

// The things that only do something small when clicked, and the plants. They're what make the room feel lived in.

// ---------------------------------------------------------------- a mug of coffee, steaming
const MUG = new THREE.Vector3(0.42, DESK_Y, -2.08);

export function Mug() {
  const st = useRef({ level: 1 });
  const liquid = useRef<THREE.Group>(null);
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const m = useMemo(() => {
    const wisp = canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }).texture;
    return {
      glaze: new THREE.MeshStandardMaterial({ color: "#9fb39a", roughness: 0.35, side: THREE.DoubleSide }),
      coffee: new THREE.MeshStandardMaterial({ color: "#3b2416", roughness: 0.15 }),
      steam: Array.from({ length: 4 }, () => new THREE.SpriteMaterial({ map: wisp, transparent: true, depthWrite: false, opacity: 0 })),
    };
  }, []);

  useFrame(({ clock }, dt) => {
    const T = clock.elapsedTime, s = st.current;
    if (liquid.current) liquid.current.scale.y += (Math.max(0.03, s.level) - liquid.current.scale.y) * Math.min(1, dt * 3);
    // wisps rise, widen and fade, one after another; fewer as the mug empties
    puffs.current.forEach((p, i) => {
      if (!p) return;
      const t = (T * 0.32 + i / 4) % 1;
      p.position.set(Math.sin(T * 1.3 + i * 2) * 0.014 * t, 0.1 + t * 0.17, Math.cos(T * 0.9 + i) * 0.01 * t);
      p.scale.setScalar(0.035 + t * 0.07);
      m.steam[i].opacity = Math.sin(t * Math.PI) * 0.2 * Math.min(1, s.level * 3);
    });
  });

  const label = () => (st.current.level > 0.05 ? "COFFEE · SIP" : "COFFEE · ONE MORE");
  const act = () => {
    const s = st.current;
    s.level = s.level > 0.05 ? Math.max(0, s.level - 0.26) : 1;
  };

  return (
    <group position={MUG} {...clickable(label, act)}>
      <mesh position={[0, 0.0475, 0]} castShadow receiveShadow material={m.glaze}><cylinderGeometry args={[0.041, 0.037, 0.095, 32, 1, true]} /></mesh>
      <mesh position={[0, 0.003, 0]} castShadow material={m.glaze}><cylinderGeometry args={[0.037, 0.037, 0.006, 32]} /></mesh>
      <mesh position={[0.045, 0.05, 0]} castShadow material={m.glaze}><torusGeometry args={[0.024, 0.006, 8, 20, Math.PI]} /></mesh>
      <group ref={liquid} position={[0, 0.006, 0]}>
        <mesh position={[0, 0.04, 0]} material={m.coffee}><cylinderGeometry args={[0.038, 0.036, 0.08, 28]} /></mesh>
      </group>
      {m.steam.map((s, i) => <sprite key={i} ref={(o) => { puffs.current[i] = o; }} material={s} />)}
    </group>
  );
}

// ---------------------------------------------------------------- a small clock on the desk, on Saigon time
function drawClock(ctx: CanvasRenderingContext2D) {
  const W = ctx.canvas.width, c = W / 2;
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = "#2b2b2b";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 ? 3 : 6;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * W * 0.36, c - Math.cos(a) * W * 0.36);
    ctx.lineTo(c + Math.sin(a) * W * 0.44, c - Math.cos(a) * W * 0.44);
    ctx.stroke();
  }
  const [h, mm] = saigonTime().split(":").map(Number);
  const hand = (a: number, len: number, w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len);
    ctx.stroke();
  };
  hand(((h % 12) + mm / 60) / 12 * Math.PI * 2, W * 0.24, 9, "#2b2b2b");
  hand((mm / 60) * Math.PI * 2, W * 0.36, 6, "#2b2b2b");
  ctx.fillStyle = "#c0632b";
  ctx.beginPath();
  ctx.arc(c, c, 8, 0, Math.PI * 2);
  ctx.fill();
}

export function DeskClock() {
  const face = useMemo(() => canvasTexture(256, 256, drawClock), []);
  const m = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: "#c0632b", roughness: 0.4 }),
    face: new THREE.MeshStandardMaterial({ map: face.texture, roughness: 0.5 }),
  }), [face]);
  const minute = useRef("");
  useFrame(() => {
    const t = saigonTime();
    if (t === minute.current) return;
    minute.current = t;
    drawClock(face.ctx);
    face.texture.needsUpdate = true;
  });
  return (
    <group position={[0.86, DESK_Y, -2.18]} rotation-y={-0.35}>
      <mesh position={[0, 0.052, 0]} rotation-x={Math.PI / 2} castShadow receiveShadow material={m.body}><cylinderGeometry args={[0.048, 0.048, 0.032, 32]} /></mesh>
      <mesh position={[0, 0.052, 0.0165]} material={m.face}><circleGeometry args={[0.041, 32]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.026, 0.004, 0]} rotation-z={s * 0.4} castShadow material={m.body}><cylinderGeometry args={[0.004, 0.004, 0.016, 8]} /></mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- the dome pendant over the desk
export function PendantLamp() {
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(0);
  const m = useMemo(() => ({
    shade: new THREE.MeshStandardMaterial({ color: "#ece3d3", roughness: 0.55 }),
    inner: new THREE.MeshStandardMaterial({ color: "#f6efe2", emissive: new THREE.Color("#ffd9a3"), emissiveIntensity: 0, side: THREE.BackSide }),
    cord: new THREE.MeshStandardMaterial({ color: "#3a3530", roughness: 0.6 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1d8") }),
  }), []);
  useFrame((_, dt) => {
    const on = useRoom.getState().lamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 10 : 4));
    if (light.current) light.current.intensity = 2.6 * k.current;
    m.inner.emissiveIntensity = 1.1 * k.current;
    m.bulb.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.8 + 3.5 * k.current);
  });
  const label = () => (useRoom.getState().lamp ? "PENDANT · SWITCH OFF" : "PENDANT · SWITCH ON");
  const x = 0.62, z = -1.62, y = 1.98;
  return (
    <group position={[x, y, z]} {...clickable(label, () => useRoom.getState().toggleLamp())}>
      <mesh position={[0, (ROOM.h - y) / 2, 0]} material={m.cord}><cylinderGeometry args={[0.003, 0.003, ROOM.h - y, 6]} /></mesh>
      <mesh position={[0, ROOM.h - y - 0.01, 0]} material={m.shade}><cylinderGeometry args={[0.04, 0.04, 0.02, 20]} /></mesh>
      <mesh position={[0, 0.005, 0]} material={m.shade}><cylinderGeometry args={[0.022, 0.026, 0.05, 20]} /></mesh>
      <group scale={[1, 0.72, 1]}>
        <mesh castShadow material={m.shade}><sphereGeometry args={[0.21, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        <mesh material={m.inner}><sphereGeometry args={[0.206, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      </group>
      <mesh position={[0, 0.02, 0]} material={m.bulb}><sphereGeometry args={[0.035, 16, 12]} /></mesh>
      <pointLight ref={light} position={[0, -0.05, 0]} color="#ffd6a0" intensity={0} distance={4} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------- the reading corner: an armchair and a lamp
const CORNER = new THREE.Vector3(-1.6, 0, 1.72);

export function ReadingCorner() {
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(0);
  const m = useMemo(() => ({
    fabric: new THREE.MeshStandardMaterial({ color: "#7b8f86", roughness: 0.95 }),
    throw: new THREE.MeshStandardMaterial({ color: "#d8b78a", roughness: 1 }),
    oak: new THREE.MeshStandardMaterial({ color: "#c9a06c", roughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.4, metalness: 0.7 }),
    shade: new THREE.MeshStandardMaterial({ color: "#efe2c6", emissive: new THREE.Color("#ffcf96"), emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide }),
  }), []);
  useFrame((_, dt) => {
    const on = useRoom.getState().floorLamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 12 : 5));
    if (light.current) light.current.intensity = 2.2 * k.current;
    m.shade.emissiveIntensity = 0.6 * k.current;
  });
  const label = () => (useRoom.getState().floorLamp ? "READING LAMP · SWITCH OFF" : "READING LAMP · SWITCH ON");
  return (
    <group>
      {/* an armchair turned toward the windows, a blanket over its arm */}
      <group position={CORNER} rotation-y={2.45}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={m.fabric}><boxGeometry args={[0.72, 0.2, 0.7]} /></mesh>
        <mesh position={[0, 0.39, 0.02]} castShadow receiveShadow material={m.fabric}><boxGeometry args={[0.6, 0.1, 0.62]} /></mesh>
        <mesh position={[0, 0.62, -0.3]} rotation-x={-0.12} castShadow receiveShadow material={m.fabric}><boxGeometry args={[0.72, 0.62, 0.14]} /></mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.33, 0.45, 0]} castShadow receiveShadow material={m.fabric}><boxGeometry args={[0.1, 0.24, 0.66]} /></mesh>
        ))}
        <mesh position={[0.33, 0.5, 0.05]} rotation-z={-0.1} castShadow material={m.throw}><boxGeometry args={[0.16, 0.06, 0.5]} /></mesh>
        {[[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.28], [0.3, 0.28]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.075, z]} castShadow material={m.oak}><cylinderGeometry args={[0.018, 0.012, 0.15, 8]} /></mesh>
        ))}
      </group>
      <group position={[-2.02, 0, 2.05]} {...clickable(label, () => useRoom.getState().toggleFloorLamp())}>
        <mesh position={[0, 0.012, 0]} castShadow receiveShadow material={m.metal}><cylinderGeometry args={[0.14, 0.16, 0.024, 32]} /></mesh>
        <mesh position={[0, 0.75, 0]} castShadow material={m.metal}><cylinderGeometry args={[0.011, 0.011, 1.48, 10]} /></mesh>
        <mesh position={[0, 1.58, 0]} castShadow material={m.shade}><cylinderGeometry args={[0.15, 0.2, 0.28, 32, 1, true]} /></mesh>
        <pointLight ref={light} position={[0, 1.5, 0]} color="#ffd6a3" intensity={0} distance={4.2} decay={2} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- plants
function heartLeaf() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.03, 0.006, 0.04, 0.045, 0, 0.07);
  s.bezierCurveTo(-0.04, 0.045, -0.03, 0.006, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

/** a monstera leaf, one unit long: a broad heart with slits running in from the edge */
function monsteraLeaf() {
  const half = (side: 1 | -1) => {
    const pts: THREE.Vector2[] = [];
    const edge = (t: number) => new THREE.Vector2(side * 0.46 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75) * (1 - 0.25 * t), t);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = edge(t);
      pts.push(p);
      // a slit at a few points along the edge, cut in toward the midrib
      if ([5, 9, 13, 17].includes(i)) {
        pts.push(new THREE.Vector2(p.x * 0.3, p.y + 0.035));
        pts.push(edge(t + 0.03).clone().setY(p.y + 0.05));
      }
    }
    return side === 1 ? pts : pts.reverse();
  };
  const outline = [...half(1), ...half(-1)];
  const g = new THREE.ShapeGeometry(new THREE.Shape(outline), 2);
  // a gentle droop from the midrib outward
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.35 - p.getY(i) * p.getY(i) * 0.15);
  g.computeVertexNormals();
  return g;
}

export function Monstera() {
  const leafGeo = useMemo(monsteraLeaf, []);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#f0ece4", roughness: 0.35 }),
    soil: new THREE.MeshStandardMaterial({ color: "#3a2a1e", roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#2f6a3c", roughness: 0.5, side: THREE.DoubleSide }),
    stem: new THREE.MeshStandardMaterial({ color: "#4f7a3c", roughness: 0.6 }),
  }), []);
  const leaves = useMemo(() => {
    const r = rng(12);
    return Array.from({ length: 9 }, (_, i) => {
      const yaw = (i / 9) * Math.PI * 2 + r() * 0.5, up = 0.55 + r() * 0.65, len = 0.32 + r() * 0.18;
      const tip = new THREE.Vector3(Math.sin(yaw) * up * 0.45, 0.35 + up * 0.55, Math.cos(yaw) * up * 0.45);
      return { yaw, tip, len, tilt: 0.5 + r() * 0.5 };
    });
  }, []);
  return (
    <group position={[-1.88, 0, -1.72]}>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow material={m.pot}><cylinderGeometry args={[0.19, 0.15, 0.34, 32]} /></mesh>
      <mesh position={[0, 0.335, 0]} material={m.soil}><cylinderGeometry args={[0.175, 0.175, 0.01, 24]} /></mesh>
      {leaves.map((l, i) => {
        const base = new THREE.Vector3(0, 0.33, 0), d = l.tip.clone().sub(base);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        return (
          <group key={i}>
            <mesh position={base.clone().add(l.tip).multiplyScalar(0.5)} quaternion={q} castShadow material={m.stem}>
              <cylinderGeometry args={[0.006, 0.008, d.length(), 6]} />
            </mesh>
            <mesh geometry={leafGeo} position={l.tip} rotation={[l.tilt, l.yaw, 0, "YXZ"]} scale={l.len} castShadow material={m.leaf} />
          </group>
        );
      })}
    </group>
  );
}

/** a pothos: a bushy pot, and vines trailing over the edge it sits on (+z) */
export function Pothos({ position, vines = 3, length = 6, rotation = 0 }: { position: [number, number, number]; vines?: number; length?: number; rotation?: number }) {
  const leaf = useMemo(heartLeaf, []);
  const greens = useMemo(() => ["#3f7d3a", "#4f8f3f", "#5f9b43", "#3a6e34"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide })), []);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#c27a52", roughness: 0.85 }),
    soil: new THREE.MeshStandardMaterial({ color: "#2b1d14", roughness: 1 }),
  }), []);
  const leaves = useMemo(() => {
    const r = rng(23 + vines * 7 + length), out: { p: [number, number, number]; rot: [number, number, number]; s: number; c: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.06;
      out.push({ p: [Math.cos(a) * d, 0.11 + r() * 0.08, Math.sin(a) * d], rot: [-0.5 - r() * 0.8, a, (r() - 0.5) * 0.8], s: 0.9 + r() * 0.5, c: Math.floor(r() * 4) });
    }
    for (let v = 0; v < vines; v++) {
      const x0 = (v - (vines - 1) / 2) * 0.05;
      for (let k = 0; k < length; k++) {
        const t = k / (length - 1);
        out.push({ p: [x0 + Math.sin(k + v) * 0.02, 0.08 - t * 0.045 * length, 0.07 + Math.min(t, 0.25) * 0.12], rot: [0.9 + r() * 0.5, (r() - 0.5) * 1.5, (r() - 0.5) * 0.8], s: 0.75 + r() * 0.3, c: Math.floor(r() * 4) });
      }
    }
    return out;
  }, [vines, length]);
  const group = useRef<THREE.Group>(null);
  const rustle = useRef(0);
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    rustle.current = Math.max(0, rustle.current - dt * 0.8);
    const T = clock.elapsedTime, amp = 0.02 + rustle.current * 0.12;
    g.children.forEach((c, i) => { c.rotation.z = c.userData.rz + Math.sin(T * (1.4 + (i % 5) * 0.3) + i) * amp; });
  });
  return (
    <group position={position} rotation-y={rotation} {...clickable("POTHOS · RUSTLE", () => { rustle.current = 1; })}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow material={m.pot}><cylinderGeometry args={[0.065, 0.048, 0.1, 24]} /></mesh>
      <mesh position={[0, 0.097, 0]} material={m.soil}><cylinderGeometry args={[0.06, 0.06, 0.006, 24]} /></mesh>
      <group ref={group}>
        {leaves.map((l, i) => (
          <mesh key={i} geometry={leaf} material={greens[l.c]} position={l.p} rotation={l.rot} scale={l.s} castShadow userData={{ rz: l.rot[2] }} />
        ))}
      </group>
    </group>
  );
}

/** a rubber plant in terracotta, in the front-right corner */
export function RubberPlant() {
  const leaf = useMemo(heartLeaf, []);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#b8663f", roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#2c4f33", roughness: 0.4, side: THREE.DoubleSide }),
    stem: new THREE.MeshStandardMaterial({ color: "#5c4a35", roughness: 0.8 }),
  }), []);
  const leaves = useMemo(() => {
    const r = rng(52);
    return Array.from({ length: 34 }, (_, i) => {
      const y = 0.45 + (i / 34) * 0.75 + r() * 0.05, a = i * 2.4;
      return { p: [Math.sin(a) * 0.07, y, Math.cos(a) * 0.07] as [number, number, number], rot: [-0.6 - r() * 0.5, a, 0] as [number, number, number], s: 2.6 + r() * 1.2 };
    });
  }, []);
  return (
    <group position={[1.9, 0, -1.78]}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow material={m.pot}><cylinderGeometry args={[0.17, 0.13, 0.32, 28]} /></mesh>
      <mesh position={[0, 0.78, 0]} castShadow material={m.stem}><cylinderGeometry args={[0.012, 0.016, 0.95, 8]} /></mesh>
      {leaves.map((l, i) => <mesh key={i} geometry={leaf} position={l.p} rotation={l.rot} scale={l.s} castShadow material={m.leaf} />)}
    </group>
  );
}

// ---------------------------------------------------------------- dust in the sunbeams
export function DustMotes() {
  const { geo, mat } = useMemo(() => {
    const r = rng(61), n = 240, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([-2.1 + r() * 4.2, 0.75 + r() * 1.8, -2.2 + r() * 2.4], i * 3);
      seed[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime, uScale;
        varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uTime * .21 + seed * 40.) * .08, sin(uTime * .13 + seed * 17.) * .12, cos(uTime * .17 + seed * 23.) * .08);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = (1.4 + seed * 2.2) * uScale / -mv.z;
          vA = .25 + .75 * pow(.5 + .5 * sin(uTime * (.6 + seed) + seed * 50.), 3.);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5);
          gl_FragColor = vec4(vec3(1., .93, .78) * 1.6, smoothstep(.5, .1, d) * vA * .32);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, []);
  useFrame(({ clock, gl }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uScale.value = gl.getPixelRatio() * 2;
  });
  return <points geometry={geo} material={mat} />;
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
    <group position={[0.62, 1.6, ROOM.z1 - 0.005]} rotation-y={Math.PI} {...clickable("LỊCH BLOC · TEAR OFF A DAY", tear)}>
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
