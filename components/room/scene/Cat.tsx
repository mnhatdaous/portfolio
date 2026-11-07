"use client";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sound } from "../lib/audio";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT } from "../lib/textures";
import { DESK_Y } from "./Desk";

// A black cat asleep on the desk, in the sun. A pat wakes it: the head comes up, the eyes open, it purrs and the tail
// flicks; another pat while it's up gets a meow. Left alone, it curls back up.
// Local coordinates: the head toward +x, the tail wrapped round the front (+z), y up from the desk.

const AWAKE_FOR = 7;
const TAIL_SEG = 30, TAIL_RAD = 10;
const HEAD = new THREE.Vector3(0.135, 0.085, 0.07);

/** the tail's path round the front of the body; `flick` lifts and swings the end, `sway` is a sleeping drift */
function tailPath(flick: number, sway: number) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.15, 0.05, -0.05),
    new THREE.Vector3(-0.19, 0.035, 0.06),
    new THREE.Vector3(-0.11, 0.028, 0.145),
    new THREE.Vector3(0.02, 0.026, 0.165),
    new THREE.Vector3(0.13, 0.03 + flick * 0.03, 0.14 + sway * 0.008),
    new THREE.Vector3(0.19 + flick * 0.015, 0.042 + flick * 0.085, 0.09 + flick * 0.05 + sway * 0.014),
  ]);
}

const P = new THREE.Vector3(), R = new THREE.Vector3();
/** rebuilds the tail tube along a new path, tapering toward the tip */
function bendTail(geo: THREE.BufferGeometry, curve: THREE.CatmullRomCurve3, tip: THREE.Object3D | null) {
  const frames = curve.computeFrenetFrames(TAIL_SEG, false);
  const pos = geo.attributes.position as THREE.BufferAttribute, nor = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= TAIL_SEG; i++) {
    const u = i / TAIL_SEG, N = frames.normals[i], B = frames.binormals[i], r = 0.021 * (1 - 0.45 * u);
    curve.getPointAt(u, P);
    for (let j = 0; j <= TAIL_RAD; j++) {
      const a = (j / TAIL_RAD) * Math.PI * 2, s = Math.sin(a), c = -Math.cos(a);
      R.set(c * N.x + s * B.x, c * N.y + s * B.y, c * N.z + s * B.z);
      const k = i * (TAIL_RAD + 1) + j;
      nor.setXYZ(k, R.x, R.y, R.z);
      pos.setXYZ(k, P.x + R.x * r, P.y + R.y * r, P.z + R.z * r);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  if (tip) curve.getPointAt(1, tip.position);
}

export default function Cat() {
  const st = useRef({ now: 0, awakeUntil: -1, wake: 0, purring: false, petAt: -10, twitchAt: 4, twitch: 0 });
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Mesh>(null);
  const eyes = useRef<(THREE.Group | null)[]>([]);
  const ears = useRef<(THREE.Group | null)[]>([]);
  const zs = useRef<(THREE.Sprite | null)[]>([]);
  const hearts = useRef<(THREE.Sprite | null)[]>([]);

  const m = useMemo(() => {
    const z = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.font = `800 50px ${FONT.display()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.strokeText("z", w / 2, h / 2);
      ctx.fillStyle = "#4a5a70";
      ctx.fillText("z", w / 2, h / 2);
    }).texture;
    const heart = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = "#ff7a96";
      ctx.beginPath();
      ctx.moveTo(32, 54);
      ctx.bezierCurveTo(6, 36, 6, 12, 22, 12);
      ctx.bezierCurveTo(28, 12, 32, 18, 32, 22);
      ctx.bezierCurveTo(32, 18, 36, 12, 42, 12);
      ctx.bezierCurveTo(58, 12, 58, 36, 32, 54);
      ctx.fill();
    }).texture;
    return {
      fur: new THREE.MeshPhysicalMaterial({ color: "#1c1e25", roughness: 0.78, sheen: 1, sheenColor: new THREE.Color("#8090b4"), sheenRoughness: 0.45 }),
      ear: new THREE.MeshStandardMaterial({ color: "#5d454b", roughness: 0.8 }),
      eye: new THREE.MeshStandardMaterial({ color: "#d6e064", emissive: new THREE.Color("#a3b336"), emissiveIntensity: 0.4, roughness: 0.15 }),
      pupil: new THREE.MeshBasicMaterial({ color: "#0b0b0d" }),
      nose: new THREE.MeshStandardMaterial({ color: "#3b2a2f", roughness: 0.6 }),
      whisker: new THREE.MeshBasicMaterial({ color: "#ece8e0", transparent: true, opacity: 0.75 }),
      z: [0, 1, 2].map(() => new THREE.SpriteMaterial({ map: z, transparent: true, depthWrite: false, opacity: 0 })),
      heart: [0, 1, 2, 3].map(() => new THREE.SpriteMaterial({ map: heart, transparent: true, depthWrite: false, opacity: 0 })),
    };
  }, []);

  const tail = useMemo(() => new THREE.TubeGeometry(tailPath(0, 0), TAIL_SEG, 0.02, TAIL_RAD, false), []);
  useLayoutEffect(() => bendTail(tail, tailPath(0, 0), tip.current), [tail]);

  useFrame(({ clock }, dt) => {
    const T = clock.elapsedTime, s = st.current;
    s.now = T;
    const awake = T < s.awakeUntil;
    s.wake += ((awake ? 1 : 0) - s.wake) * Math.min(1, dt * (awake ? 4 : 1.4));
    const w = s.wake;
    if (awake !== s.purring) {
      s.purring = awake;
      sound.purr(awake);
    }
    // breathing: slow asleep, a little quicker awake
    const br = Math.sin(T * (awake ? 2.6 : 1.7));
    body.current?.scale.set(1, 1 + br * 0.03, 1 + br * 0.015);
    // the head: tucked onto the paws asleep, up and turned toward you awake
    if (head.current) {
      head.current.rotation.set(0.12 * (1 - w), 0.35 * (1 - w) - 0.8 * w, -0.32 * (1 - w) + 0.16 * w + Math.sin(T * 1.6) * 0.035 * w);
      head.current.position.y = HEAD.y + 0.035 * w + br * 0.002;
    }
    const blink = awake && T % 3.3 < 0.12 ? 0.12 : 1;
    eyes.current.forEach((e) => e?.scale.set(1, Math.max(0.001, w * blink), 1));
    // an ear twitches now and then in its sleep; awake, both prick up
    if (!awake && T > s.twitchAt) {
      s.twitch = 1;
      s.twitchAt = T + 5 + Math.random() * 7;
    }
    s.twitch = Math.max(0, s.twitch - dt * 4);
    ears.current.forEach((e, i) => {
      if (!e) return;
      const side = i ? -1 : 1;
      e.rotation.x = side * (0.28 - 0.14 * w) + (i ? Math.sin(T * 38) * 0.2 * s.twitch : 0);
    });
    bendTail(tail, tailPath(w * (0.5 + 0.5 * Math.sin(T * 3.1)), Math.sin(T * 0.45)), tip.current);
    // z's drift up while it sleeps
    zs.current.forEach((z, i) => {
      if (!z) return;
      const t = (T * 0.26 + i / 3) % 1;
      z.position.set(HEAD.x + 0.03 + t * 0.05, HEAD.y + 0.11 + t * 0.16, HEAD.z + Math.sin(t * 6 + i) * 0.02);
      z.scale.setScalar(0.024 + t * 0.026);
      m.z[i].opacity = Math.sin(t * Math.PI) * 0.85 * (1 - w);
    });
    // hearts after a pat
    hearts.current.forEach((h, i) => {
      if (!h) return;
      const t = (T - s.petAt - i * 0.2) / 1.5;
      h.visible = t > 0 && t < 1;
      if (!h.visible) return;
      h.position.set(HEAD.x + (i - 1.5) * 0.03 + Math.sin(t * 5 + i) * 0.01, HEAD.y + 0.1 + t * 0.14, HEAD.z + 0.02);
      h.scale.setScalar(0.022 + t * 0.016);
      m.heart[i].opacity = Math.sin(t * Math.PI);
    });
  });

  const pet = () => {
    const s = st.current, wasAwake = s.now < s.awakeUntil;
    s.awakeUntil = s.now + AWAKE_FOR;
    s.petAt = s.now;
    if (wasAwake) sound.meow();
    else sound.mrrp();
  };
  const label = () => (st.current.now < st.current.awakeUntil ? "CAT · PURRING · PET AGAIN" : "CAT · PET");

  const ball = (p: [number, number, number], s: [number, number, number], mat: THREE.Material = m.fur, rot?: [number, number, number]) => (
    <mesh position={p} scale={s} rotation={rot} castShadow receiveShadow material={mat}><sphereGeometry args={[1, 28, 18]} /></mesh>
  );

  return (
    <group position={[-0.72, DESK_Y, -2.02]} rotation-y={0.15} {...clickable(label, pet)}>
      <group ref={body}>
        {ball([0, 0.082, 0], [0.155, 0.085, 0.12])}
        {ball([-0.075, 0.088, -0.025], [0.105, 0.085, 0.095])}
        {ball([0.085, 0.07, 0.035], [0.085, 0.07, 0.085])}
      </group>
      {ball([0.17, 0.02, 0.035], [0.042, 0.02, 0.026], m.fur, [0, -0.2, 0])}
      {ball([0.16, 0.02, 0.095], [0.042, 0.02, 0.026], m.fur, [0, 0.15, 0])}
      <mesh geometry={tail} castShadow receiveShadow material={m.fur} />
      <mesh ref={tip} castShadow material={m.fur}><sphereGeometry args={[0.0116, 12, 10]} /></mesh>

      <group ref={head} position={HEAD}>
        {ball([0.04, 0, 0], [0.06, 0.054, 0.057])}
        {ball([0.088, -0.016, 0], [0.022, 0.019, 0.028])}
        {ball([0.108, -0.006, 0], [0.006, 0.005, 0.008], m.nose)}
        {[-1, 1].map((side, i) => (
          <group key={side} ref={(g) => { ears.current[i] = g; }} position={[0.028, 0.04, side * 0.03]}>
            <mesh position={[0, 0.02, 0]} castShadow material={m.fur}><coneGeometry args={[0.022, 0.048, 12]} /></mesh>
            <mesh position={[0.006, 0.016, 0]} material={m.ear}><coneGeometry args={[0.013, 0.032, 10]} /></mesh>
          </group>
        ))}
        {[-1, 1].map((side, i) => (
          <group key={side} ref={(g) => { eyes.current[i] = g; }} position={[0.09, 0.012, side * 0.025]} rotation-y={-side * 0.45}>
            <mesh scale={[0.0055, 0.0078, 0.0115]} material={m.eye}><sphereGeometry args={[1, 16, 12]} /></mesh>
            <mesh position={[0.0035, 0, 0]} scale={[0.0032, 0.007, 0.0026]} material={m.pupil}><sphereGeometry args={[1, 12, 10]} /></mesh>
          </group>
        ))}
        {[-1, 1].flatMap((side) => [-0.012, 0, 0.012].map((dy) => (
          <mesh key={`${side}${dy}`} position={[0.09, -0.014 + dy * 0.5, side * 0.05]} rotation={[side * (Math.PI / 2 - 0.15), 0, dy * 4]} material={m.whisker}>
            <cylinderGeometry args={[0.0007, 0.0004, 0.07, 4]} />
          </mesh>
        )))}
      </group>

      {m.z.map((mat, i) => <sprite key={i} ref={(o) => { zs.current[i] = o; }} material={mat} />)}
      {m.heart.map((mat, i) => <sprite key={i} ref={(o) => { hearts.current[i] = o; }} material={mat} visible={false} />)}
    </group>
  );
}
