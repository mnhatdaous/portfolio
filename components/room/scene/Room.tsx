"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BACK_LABEL, clickable, clickOutside, solid } from "../lib/interact";
import { planksTexture, plasterTexture, rugTexture, woodTexture } from "../lib/textures";
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
export const OAK = "#d3a774";

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

/** the oak that lines the window openings: sills, heads, the corner posts, mullions */
const LINING: { p: V3; s: V3 }[] = [
  { p: [0, WIN.y0 + 0.012, ROOM.z0 - T / 2 + 0.015], s: [W, 0.024, T + 0.03] },
  { p: [0, WIN.y1 - 0.012, ROOM.z0 - T / 2], s: [W, 0.024, T] },
  ...[-0.95, 0.95].map((x) => ({ p: [x, (WIN.y0 + WIN.y1) / 2, ROOM.z0 - T / 2] as V3, s: [0.06, WIN.y1 - WIN.y0, T * 0.75] as V3 })),
  ...SIDES.flatMap(({ s, x }) => [
    { p: [x - s * 0.015, WIN.sideY0 + 0.012, SIDE_MID] as V3, s: [T + 0.03, 0.024, SIDE_LEN] as V3 },
    { p: [x, WIN.y1 - 0.012, SIDE_MID] as V3, s: [T, 0.024, SIDE_LEN] as V3 },
    { p: [x, (WIN.sideY0 + WIN.y1) / 2, WIN.sideZ1 - 0.012] as V3, s: [T, WIN.y1 - WIN.sideY0, 0.024] as V3 },
    { p: [x, (WIN.sideY0 + WIN.y1) / 2, SIDE_MID] as V3, s: [T * 0.75, WIN.y1 - WIN.sideY0, 0.06] as V3 },
    { p: [x, (WIN.sideY0 + WIN.y1) / 2, ROOM.z0 - T / 2] as V3, s: [T + 0.03, WIN.y1 - WIN.sideY0, T + 0.03] as V3 },
  ]),
];

/** skirting boards along the solid walls */
const SKIRTING: { p: V3; s: V3 }[] = [
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
      floor: new THREE.MeshStandardMaterial({ map: planksTexture("#cfa673", [W / 1.1, D / 2.2]), roughness: 0.55 }),
      ceil: new THREE.MeshStandardMaterial({ color: "#f2ebe0", roughness: 1 }),
      oak: new THREE.MeshStandardMaterial({ map: woodTexture(21, OAK, [1, 1]), roughness: 0.5 }),
      glass: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.02, depthWrite: false }),
      rug: new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
      door: new THREE.MeshStandardMaterial({ color: "#ebe4d8", roughness: 0.7 }),
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
      {[...LINING, ...SKIRTING].map((b, i) => (
        <mesh key={i} position={b.p} castShadow receiveShadow material={m.oak}>
          <primitive object={soft(...b.s)} attach="geometry" />
        </mesh>
      ))}

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

/** the way out, in the back wall: a painted door in an oak casing */
function Door({ m }: { m: { oak: THREE.Material; door: THREE.Material; brass: THREE.Material } }) {
  const x = 1.4, w = 0.86, h = 2.05, z = ROOM.z1;
  return (
    <group>
      <mesh position={[x, h / 2, z - 0.014]} castShadow receiveShadow material={m.door}><primitive object={soft(w, h, 0.03)} attach="geometry" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * (w / 2 + 0.03), h / 2 + 0.03, z - 0.012]} castShadow material={m.oak}><primitive object={soft(0.06, h + 0.06, 0.026)} attach="geometry" /></mesh>
      ))}
      <mesh position={[x, h + 0.06, z - 0.012]} castShadow material={m.oak}><primitive object={soft(w + 0.12, 0.06, 0.026)} attach="geometry" /></mesh>
      <mesh position={[x - w / 2 + 0.08, 1.02, z - 0.045]} rotation-z={Math.PI / 2} castShadow material={m.brass}>
        <cylinderGeometry args={[0.009, 0.009, 0.12, 12]} />
      </mesh>
      <mesh position={[x - w / 2 + 0.08 - 0.05, 1.02, z - 0.035]} rotation-x={Math.PI / 2} material={m.brass}>
        <cylinderGeometry args={[0.022, 0.022, 0.012, 20]} />
      </mesh>
    </group>
  );
}

/** a desk chair to sink into: a padded cognac-leather seat, a channel-tufted back and padded arms, on a black swivel
 * base with casters. Pulled out a little and turned, as if someone just got up. */
function Chair() {
  const m = useMemo(() => ({
    leather: new THREE.MeshPhysicalMaterial({
      color: "#8f5232", roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.5, sheen: 0.35, sheenColor: new THREE.Color("#dba57c"),
    }),
    seam: new THREE.MeshStandardMaterial({ color: "#5e331d", roughness: 0.7 }),
    base: new THREE.MeshStandardMaterial({ color: "#1d1f22", roughness: 0.4, metalness: 0.5 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.18, metalness: 0.95 }),
  }), []);
  const g = useMemo(() => ({
    seat: new RoundedBoxGeometry(0.52, 0.1, 0.5, 4, 0.045),
    back: new RoundedBoxGeometry(0.5, 0.48, 0.08, 4, 0.038),
    channel: new RoundedBoxGeometry(0.44, 0.135, 0.04, 4, 0.019),
    arm: new RoundedBoxGeometry(0.075, 0.038, 0.28, 3, 0.017),
  }), []);
  return (
    <group position={[0.18, 0, -1.2]} rotation-y={0.38}>
      {/* the swivel base: five spokes on casters, a chrome column */}
      {[0, 1, 2, 3, 4].map((k) => {
        const a = (k / 5) * Math.PI * 2;
        return (
          <group key={k} rotation-y={a}>
            <mesh position={[0, 0.075, 0.15]} rotation-x={0.12} castShadow material={m.base}><primitive object={soft(0.04, 0.03, 0.3, 0.012)} attach="geometry" /></mesh>
            <mesh position={[0, 0.03, 0.29]} rotation-z={Math.PI / 2} castShadow material={m.base}><cylinderGeometry args={[0.028, 0.028, 0.03, 16]} /></mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.1, 0]} castShadow material={m.base}><cylinderGeometry args={[0.04, 0.05, 0.06, 20]} /></mesh>
      <mesh position={[0, 0.26, 0]} castShadow material={m.chrome}><cylinderGeometry args={[0.022, 0.022, 0.28, 16]} /></mesh>
      <mesh position={[0, 0.405, 0.02]} castShadow material={m.base}><primitive object={soft(0.24, 0.035, 0.26, 0.01)} attach="geometry" /></mesh>
      {/* the seat */}
      <mesh geometry={g.seat} position={[0, 0.47, 0]} castShadow receiveShadow material={m.leather} />
      {/* the back, leaning a little, with three padded channels on its face */}
      <group position={[0, 0.8, 0.25]} rotation-x={-0.16}>
        <mesh position={[0, -0.25, -0.01]} castShadow material={m.base}><primitive object={soft(0.08, 0.16, 0.03, 0.01)} attach="geometry" /></mesh>
        <mesh geometry={g.back} castShadow receiveShadow material={m.leather} />
        {[-0.15, 0, 0.15].map((y) => (
          <mesh key={y} geometry={g.channel} position={[0, y, -0.045]} castShadow receiveShadow material={m.leather} />
        ))}
        {[-0.075, 0.075].map((y) => (
          <mesh key={y} position={[0, y, -0.042]} material={m.seam}><primitive object={soft(0.42, 0.006, 0.01, 0.002)} attach="geometry" /></mesh>
        ))}
      </group>
      {/* padded arms on black supports */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.29, 0, 0.02]}>
          <mesh position={[0, 0.57, 0.05]} castShadow material={m.base}><primitive object={soft(0.03, 0.2, 0.04, 0.008)} attach="geometry" /></mesh>
          <mesh geometry={g.arm} position={[0, 0.68, 0.01]} castShadow receiveShadow material={m.leather} />
        </group>
      ))}
    </group>
  );
}
