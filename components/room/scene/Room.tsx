"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BACK_LABEL, clickable, clickOutside, solid } from "../lib/interact";
import { canvasTexture, concreteTexture, plasterTexture, rng, rugTexture } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";

// The study: one room on a hill above the lake. The big window over the desk runs corner to corner and the side
// windows run back to the middle of the room, so from the middle the view fills half the circle; the back half is
// walls, with the board, the bookshelves and the door.
// Metres; y up; the window wall is at z = -2.3 and the camera starts in the middle, facing it.
export const ROOM = { x0: -2.3, x1: 2.3, z0: -2.3, z1: 2.3, h: 2.85 };
/** the walls are this thick, built outward from the room's inner faces */
export const WALL_T = 0.16;
/** the big window's sill and head; the side windows start lower and run back to z = sideZ1 */
export const WIN = { y0: 0.8, y1: 2.5, sideY0: 0.5, sideZ1: 0.35 };

type V3 = [number, number, number];
const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h, T = WALL_T;
const SIDE_LEN = WIN.sideZ1 - ROOM.z0, BACK_LEN = ROOM.z1 + T - WIN.sideZ1, SIDE_MID = (ROOM.z0 + WIN.sideZ1) / 2;
const SIDES = [-1, 1].map((s) => ({ s, x: s < 0 ? ROOM.x0 - T / 2 : ROOM.x1 + T / 2 }));

/** wall pieces around the windows, and the size of the face each shows the room (for the plaster's scale) */
const WALLS: { p: V3; s: V3; face: [number, number] }[] = [
  { p: [0, WIN.y0 / 2, ROOM.z0 - T / 2], s: [W + 2 * T, WIN.y0, T], face: [W, WIN.y0] },
  { p: [0, (WIN.y1 + H) / 2, ROOM.z0 - T / 2], s: [W + 2 * T, H - WIN.y1, T], face: [W, H - WIN.y1] },
  ...SIDES.flatMap(({ x }) => [
    { p: [x, WIN.sideY0 / 2, SIDE_MID] as V3, s: [T, WIN.sideY0, SIDE_LEN] as V3, face: [SIDE_LEN, WIN.sideY0] as [number, number] },
    { p: [x, (WIN.y1 + H) / 2, SIDE_MID] as V3, s: [T, H - WIN.y1, SIDE_LEN] as V3, face: [SIDE_LEN, H - WIN.y1] as [number, number] },
    { p: [x, H / 2, WIN.sideZ1 + BACK_LEN / 2] as V3, s: [T, H, BACK_LEN] as V3, face: [BACK_LEN, H] as [number, number] },
  ]),
  { p: [0, H / 2, ROOM.z1 + T / 2], s: [W + 2 * T, H, T], face: [W, H] },
];

type Box = { p: V3; s: V3 };
const SIDE_H = WIN.y1 - WIN.sideY0, SIDE_C = (WIN.sideY0 + WIN.y1) / 2, BAR = 0.035;

/** the window openings: stone sills, white linings at the heads and ends */
const SILLS: Box[] = [
  { p: [0, WIN.y0 + 0.012, ROOM.z0 - T / 2 + 0.015], s: [W, 0.024, T + 0.03] },
  ...SIDES.map(({ s, x }) => ({ p: [x - s * 0.015, WIN.sideY0 + 0.012, SIDE_MID] as V3, s: [T + 0.03, 0.024, SIDE_LEN] as V3 })),
];
const LININGS: Box[] = [
  { p: [0, WIN.y1 - 0.012, ROOM.z0 - T / 2], s: [W, 0.024, T] },
  ...SIDES.flatMap(({ x }) => [
    { p: [x, WIN.y1 - 0.012, SIDE_MID] as V3, s: [T, 0.024, SIDE_LEN] as V3 },
    { p: [x, SIDE_C, WIN.sideZ1 - 0.012] as V3, s: [T, SIDE_H, 0.024] as V3 },
  ]),
];
/** slim black frames at the glass: mullions, a post in each front corner, bars along every edge */
const FRAMES: Box[] = [
  ...[-0.95, 0.95].map((x) => ({ p: [x, (WIN.y0 + WIN.y1) / 2, ROOM.z0 - T / 2] as V3, s: [0.045, WIN.y1 - WIN.y0, 0.07] as V3 })),
  { p: [0, WIN.y0 + 0.024 + BAR / 2, ROOM.z0 - T / 2], s: [W, BAR, 0.06] },
  { p: [0, WIN.y1 - 0.024 - BAR / 2, ROOM.z0 - T / 2], s: [W, BAR, 0.06] },
  ...SIDES.flatMap(({ s, x }) => [
    { p: [x, SIDE_C, SIDE_MID] as V3, s: [0.07, SIDE_H, 0.045] as V3 },
    { p: [s < 0 ? ROOM.x0 - 0.06 : ROOM.x1 + 0.06, SIDE_C, ROOM.z0 - 0.06] as V3, s: [0.12, SIDE_H, 0.12] as V3 },
    { p: [x, WIN.sideY0 + 0.024 + BAR / 2, SIDE_MID] as V3, s: [0.06, BAR, SIDE_LEN] as V3 },
    { p: [x, WIN.y1 - 0.024 - BAR / 2, SIDE_MID] as V3, s: [0.06, BAR, SIDE_LEN] as V3 },
    { p: [x, SIDE_C, WIN.sideZ1 - 0.024 - BAR / 2] as V3, s: [0.06, SIDE_H, BAR] as V3 },
  ]),
];

/** skirting boards along the solid walls */
const SKIRTING: Box[] = [
  { p: [0, 0.035, ROOM.z1 - 0.008], s: [W, 0.07, 0.016] },
  { p: [0, 0.035, ROOM.z0 + 0.008], s: [W, 0.07, 0.016] },
  ...SIDES.map(({ s }) => ({ p: [s < 0 ? ROOM.x0 + 0.008 : ROOM.x1 - 0.008, 0.035, (WIN.sideZ1 + ROOM.z1) / 2] as V3, s: [0.016, 0.07, ROOM.z1 - WIN.sideZ1] as V3 })),
];

function repeated(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

export default function Room() {
  const m = useMemo(() => {
    const plaster = plasterTexture("#efe7da", [1, 1], 7);
    return {
      walls: WALLS.map((w) => new THREE.MeshStandardMaterial({ map: repeated(plaster, w.face[0] / 1.4, w.face[1] / 1.4), roughness: 0.95 })),
      floor: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.42 }),
      ceil: new THREE.MeshStandardMaterial({ color: "#f2ebe0", roughness: 1 }),
      trim: new THREE.MeshStandardMaterial({ color: "#f3f0ea", roughness: 0.75 }),
      stone: new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.45 }),
      frame: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.4, metalness: 0.55 }),
      glass: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.02, depthWrite: false }),
      rug: new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
      door: new THREE.MeshStandardMaterial({ color: "#4a4d52", roughness: 0.6 }),
      brass: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.38, metalness: 0.6 }),
    };
  }, []);
  // at home the glass takes you to the window; from anywhere else a click on the view is a click outside
  const lookOut = clickable(
    () => (useRoom.getState().page === "home" ? "LOOK OUTSIDE" : BACK_LABEL),
    () => (useRoom.getState().page === "home" ? useRoom.getState().go("window") : clickOutside()),
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow material={m.floor} {...solid}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* the ceiling is a slab, so the sun only comes in through the windows */}
      <mesh position={[0, H + 0.06, 0]} castShadow receiveShadow material={m.ceil}>
        <boxGeometry args={[W + 2 * T, 0.12, D + 2 * T]} />
      </mesh>
      {WALLS.map((w, i) => (
        <mesh key={i} position={w.p} castShadow receiveShadow material={m.walls[i]} {...solid}>
          <boxGeometry args={w.s} />
        </mesh>
      ))}
      {([[SILLS, m.stone], [[...LININGS, ...SKIRTING], m.trim], [FRAMES, m.frame]] as const).flatMap(([boxes, mat], k) =>
        boxes.map((b, i) => (
          <mesh key={`${k}-${i}`} position={b.p} castShadow receiveShadow material={mat}>
            <primitive object={soft(...b.s)} attach="geometry" />
          </mesh>
        )),
      )}

      {/* the glass: barely there, but it's what a click on the view lands on */}
      <group {...lookOut}>
        <mesh position={[0, (WIN.y0 + WIN.y1) / 2, ROOM.z0 - T / 2]} material={m.glass}>
          <planeGeometry args={[W, WIN.y1 - WIN.y0]} />
        </mesh>
        {SIDES.map(({ s, x }) => (
          <mesh key={s} position={[x, (WIN.sideY0 + WIN.y1) / 2, SIDE_MID]} rotation-y={-s * Math.PI / 2} material={m.glass}>
            <planeGeometry args={[SIDE_LEN, WIN.y1 - WIN.sideY0]} />
          </mesh>
        ))}
      </group>

      <mesh rotation-x={-Math.PI / 2} position={[0.1, 0.003, 0.45]} receiveShadow material={m.rug}>
        <planeGeometry args={[2.6, 1.8]} />
      </mesh>

      <Door m={m} />
      <Chair />
    </group>
  );
}

/** the way out, in the back wall: a charcoal door in a white casing */
function Door({ m }: { m: { trim: THREE.Material; door: THREE.Material; brass: THREE.Material } }) {
  const x = 1.4, w = 0.86, h = 2.05, z = ROOM.z1;
  return (
    <group>
      <mesh position={[x, h / 2, z - 0.014]} castShadow receiveShadow material={m.door}><primitive object={soft(w, h, 0.03)} attach="geometry" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * (w / 2 + 0.03), h / 2 + 0.03, z - 0.012]} castShadow material={m.trim}><primitive object={soft(0.06, h + 0.06, 0.026)} attach="geometry" /></mesh>
      ))}
      <mesh position={[x, h + 0.06, z - 0.012]} castShadow material={m.trim}><primitive object={soft(w + 0.12, 0.06, 0.026)} attach="geometry" /></mesh>
      <mesh position={[x - w / 2 + 0.08, 1.02, z - 0.045]} rotation-z={Math.PI / 2} castShadow material={m.brass}>
        <cylinderGeometry args={[0.009, 0.009, 0.12, 12]} />
      </mesh>
      <mesh position={[x - w / 2 + 0.08 - 0.05, 1.02, z - 0.035]} rotation-x={Math.PI / 2} material={m.brass}>
        <cylinderGeometry args={[0.022, 0.022, 0.012, 20]} />
      </mesh>
    </group>
  );
}

/** a soft cushion: a rounded unit box stretched to size, so the corners round broadly across the face and gently
 * at the edges */
const pillow = (w: number, h: number, d: number, k = 0.25) => new RoundedBoxGeometry(1, 1, 1, 5, k).scale(w, h, d);

/** an ergonomic desk chair: caramel woven upholstery on a cream frame, a tall back and a headrest, T-arms with soft
 * pads, a five-star base on black casters. It stands at the end of the desk, turned toward the room. */
function Chair() {
  const m = useMemo(() => {
    const weave = canvasTexture(256, 256, (ctx, w, h) => {
      const r = rng(71);
      ctx.fillStyle = "#b5753f";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { ctx.fillStyle = `rgba(80,40,15,${0.08 + r() * 0.06})`; ctx.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 4) { ctx.fillStyle = `rgba(255,220,180,${0.05 + r() * 0.05})`; ctx.fillRect(x, 0, 1, h); }
      for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? "70,35,12" : "255,225,190"},${r() * 0.1})`; ctx.fillRect(r() * w, r() * h, 1.5, 1.5); }
    }, { repeat: [3, 3] }).texture;
    return {
      fabric: new THREE.MeshPhysicalMaterial({ map: weave, roughness: 0.9, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color("#f0c08e") }),
      cream: new THREE.MeshStandardMaterial({ color: "#ebe5da", roughness: 0.45 }),
      pad: new THREE.MeshStandardMaterial({ color: "#c9bdab", roughness: 0.6 }),
      black: new THREE.MeshStandardMaterial({ color: "#1b1d20", roughness: 0.45, metalness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.18, metalness: 0.95 }),
    };
  }, []);
  const g = useMemo(() => ({
    seat: pillow(0.5, 0.08, 0.48),
    back: pillow(0.46, 0.62, 0.075, 0.22),
    head: pillow(0.3, 0.13, 0.075, 0.3),
    pad: pillow(0.085, 0.03, 0.24, 0.3),
  }), []);
  return (
    <group position={[0.82, 0, -1.25]} rotation-y={2.35}>
      {/* the base: five cream spokes on twin-wheel casters, a black column with a chrome collar */}
      {[0, 1, 2, 3, 4].map((k) => (
        <group key={k} rotation-y={(k / 5) * Math.PI * 2}>
          <mesh position={[0, 0.075, 0.16]} rotation-x={0.08} castShadow material={m.cream}><primitive object={soft(0.05, 0.035, 0.3, 0.014)} attach="geometry" /></mesh>
          {[-1, 1].map((w) => (
            <mesh key={w} position={[w * 0.012, 0.03, 0.315]} rotation-z={Math.PI / 2} castShadow material={m.black}><cylinderGeometry args={[0.028, 0.028, 0.012, 18]} /></mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.09, 0]} castShadow material={m.cream}><cylinderGeometry args={[0.05, 0.055, 0.05, 24]} /></mesh>
      <mesh position={[0, 0.235, 0]} castShadow material={m.black}><cylinderGeometry args={[0.024, 0.024, 0.25, 16]} /></mesh>
      <mesh position={[0, 0.33, 0]} material={m.chrome}><cylinderGeometry args={[0.026, 0.026, 0.03, 16]} /></mesh>
      {/* the seat on its cream pan and mechanism */}
      <mesh position={[0, 0.385, 0.02]} castShadow material={m.cream}><primitive object={soft(0.24, 0.05, 0.26, 0.015)} attach="geometry" /></mesh>
      <mesh position={[0, 0.42, 0]} castShadow material={m.cream}><primitive object={soft(0.48, 0.02, 0.44, 0.008)} attach="geometry" /></mesh>
      <mesh geometry={g.seat} position={[0, 0.465, 0]} castShadow receiveShadow material={m.fabric} />
      {/* the back, leaning a little, on a cream spine, and the headrest above it */}
      <group position={[0, 0.86, 0.24]} rotation-x={-0.1}>
        <mesh geometry={g.back} castShadow receiveShadow material={m.fabric} />
        <mesh position={[0, -0.2, 0.045]} castShadow material={m.cream}><primitive object={soft(0.07, 0.5, 0.03, 0.012)} attach="geometry" /></mesh>
        <mesh position={[0, 0.34, 0.035]} castShadow material={m.cream}><primitive object={soft(0.05, 0.09, 0.02, 0.008)} attach="geometry" /></mesh>
        <mesh geometry={g.head} position={[0, 0.405, 0.005]} castShadow receiveShadow material={m.fabric} />
      </group>
      {/* T-arms: a cream post rising from under the seat, a soft pad on top */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh position={[sx * 0.235, 0.43, 0.02]} castShadow material={m.cream}><primitive object={soft(0.09, 0.03, 0.05, 0.01)} attach="geometry" /></mesh>
          <mesh position={[sx * 0.28, 0.55, 0.02]} castShadow material={m.cream}><primitive object={soft(0.045, 0.26, 0.05, 0.015)} attach="geometry" /></mesh>
          <mesh geometry={g.pad} position={[sx * 0.28, 0.695, -0.02]} castShadow receiveShadow material={m.pad} />
        </group>
      ))}
    </group>
  );
}
