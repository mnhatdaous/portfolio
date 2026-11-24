"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { BACK_LABEL, clickable, clickOutside, solid } from "../lib/interact";
import { planksTexture, plasterTexture, rugTexture, woodTexture } from "../lib/textures";
import { curvedSlat, soft } from "../lib/shapes";
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

/** a molded chair at the desk: a white seat and a curved back, on slim black legs splayed a little */
function Chair() {
  const m = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: "#ecebe6", roughness: 0.42 }),
    steel: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.38, metalness: 0.6 }),
  }), []);
  const back = useMemo(() => curvedSlat(0.3, 0.012, 1.45, 0.26), []);
  return (
    <group position={[0.08, 0, -1.25]} rotation-y={0.12}>
      <mesh position={[0, 0.455, 0]} castShadow receiveShadow material={m.shell}><primitive object={soft(0.46, 0.03, 0.44, 0.015)} attach="geometry" /></mesh>
      <group position={[0, 0.62, 0.2]} rotation-x={-0.15}>
        <mesh geometry={back} position={[0, 0, -0.306]} castShadow receiveShadow material={m.shell} />
      </group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * 0.18, 0.22, sz * 0.17]} rotation={[-sz * 0.1, 0, sx * 0.1]} castShadow material={m.steel}>
          <cylinderGeometry args={[0.009, 0.007, 0.45, 8]} />
        </mesh>
      ))}
    </group>
  );
}
