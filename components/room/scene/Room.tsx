"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clickable, solid } from "../lib/interact";
import { plasterTexture, tileTexture, woodTexture } from "../lib/textures";
import { useRoom } from "../store";

// The apartment: one room on the first floor of a tube house, the desk under the window, the alley outside.
// Metres; y up; the window wall is at z = -0.5 and the camera looks at it from +z.
export const ROOM = { x0: -1.9, x1: 2.1, h: 2.8, z0: -0.5, z1: 3.8 };
export const WIN = { x0: -0.6, x1: 1.0, y0: 0.98, y1: 2.38, zOut: -0.72 };
const WALL_D = ROOM.z0 - WIN.zOut;

function repeated(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

export default function Room() {
  const m = useMemo(() => {
    const plaster = plasterTexture("#a3c3b0", [1, 1]);
    const wall = (w: number, h: number) => new THREE.MeshStandardMaterial({ map: repeated(plaster, w / 1.3, h / 1.3), roughness: 0.95 });
    return {
      wall,
      floor: new THREE.MeshStandardMaterial({ map: tileTexture([20, 21.5]), roughness: 0.38 }),
      ceil: new THREE.MeshStandardMaterial({ color: "#c9cbc1", roughness: 1 }),
      skirting: new THREE.MeshStandardMaterial({ color: "#3d3129", roughness: 0.6 }),
      frame: new THREE.MeshStandardMaterial({ color: "#2d5848", roughness: 0.5 }),
      iron: new THREE.MeshStandardMaterial({ color: "#17191b", roughness: 0.45, metalness: 0.6 }),
      sill: new THREE.MeshStandardMaterial({ map: woodTexture(21, "#6b4226", [1, 1]), roughness: 0.45 }),
      curtain: new THREE.MeshStandardMaterial({ color: "#d7ccb6", roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.93 }),
      rod: new THREE.MeshStandardMaterial({ color: "#8a7a62", roughness: 0.4, metalness: 0.5 }),
      lampGlass: new THREE.MeshStandardMaterial({ color: "#e9e6dc", roughness: 0.6 }),
      chair: new THREE.MeshStandardMaterial({ map: woodTexture(31, "#5a3420", [1, 1]), roughness: 0.55 }),
    };
  }, []);

  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h;
  const cx = (ROOM.x0 + ROOM.x1) / 2, cz = (ROOM.z0 + ROOM.z1) / 2, zw = ROOM.z0 - WALL_D / 2;
  const winW = WIN.x1 - WIN.x0, winH = WIN.y1 - WIN.y0, wcx = (WIN.x0 + WIN.x1) / 2;
  const pieces: [number, number, number, number][] = [
    // x, y, w, h of the window wall around the opening
    [(ROOM.x0 + WIN.x0) / 2, H / 2, WIN.x0 - ROOM.x0, H],
    [(WIN.x1 + ROOM.x1) / 2, H / 2, ROOM.x1 - WIN.x1, H],
    [wcx, WIN.y0 / 2, winW, WIN.y0],
    [wcx, (WIN.y1 + H) / 2, winW, H - WIN.y1],
  ];

  return (
    <group>
      {/* floor, ceiling, walls */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} receiveShadow material={m.floor} {...solid}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[cx, H, cz]} material={m.ceil}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {pieces.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, zw]} receiveShadow material={m.wall(w, h)} {...solid}>
          <boxGeometry args={[w, h, WALL_D]} />
        </mesh>
      ))}
      <mesh position={[ROOM.x0, H / 2, cz]} rotation-y={Math.PI / 2} receiveShadow material={m.wall(D, H)} {...solid}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh position={[ROOM.x1, H / 2, cz]} rotation-y={-Math.PI / 2} receiveShadow material={m.wall(D, H)} {...solid}>
        <planeGeometry args={[D, H]} />
      </mesh>
      <mesh position={[cx, H / 2, ROOM.z1]} rotation-y={Math.PI} material={m.wall(W, H)} {...solid}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* skirting boards */}
      <mesh position={[cx, 0.04, ROOM.z0 + 0.008]} material={m.skirting}><boxGeometry args={[W, 0.08, 0.016]} /></mesh>
      <mesh position={[ROOM.x0 + 0.008, 0.04, cz]} material={m.skirting}><boxGeometry args={[0.016, 0.08, D]} /></mesh>
      <mesh position={[ROOM.x1 - 0.008, 0.04, cz]} material={m.skirting}><boxGeometry args={[0.016, 0.08, D]} /></mesh>

      <WindowFrame m={m} />

      {/* the sill */}
      <mesh position={[wcx, WIN.y0 + 0.012, -0.53]} castShadow receiveShadow material={m.sill} {...solid}>
        <boxGeometry args={[winW + 0.12, 0.028, 0.2]} />
      </mesh>

      <Curtain material={m.curtain} />
      <mesh position={[(WIN.x0 + 1.5) / 2 - 0.05, 2.5, -0.44]} rotation-z={Math.PI / 2} material={m.rod}>
        <cylinderGeometry args={[0.009, 0.009, 2.3, 10]} />
      </mesh>

      {/* the ceiling light, off */}
      <mesh position={[0.15, H - 0.03, 1.6]} material={m.lampGlass}>
        <cylinderGeometry args={[0.2, 0.22, 0.05, 32]} />
      </mesh>

      <Chair material={m.chair} />
    </group>
  );
}

function WindowFrame({ m }: { m: { frame: THREE.Material; iron: THREE.Material } }) {
  const z = -0.66, winW = WIN.x1 - WIN.x0, winH = WIN.y1 - WIN.y0, wcx = (WIN.x0 + WIN.x1) / 2, wcy = (WIN.y0 + WIN.y1) / 2;
  const t = 0.055;
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let x = WIN.x0 + 0.1; x < WIN.x1 - 0.05; x += 0.125) out.push(x);
    return out;
  }, []);
  return (
    <group {...clickable("LOOK OUTSIDE", () => useRoom.getState().go("window"))}>
      {/* painted wooden frame: outer, the middle post, the transom */}
      <mesh position={[wcx, WIN.y1 - t / 2, z]} material={m.frame}><boxGeometry args={[winW, t, 0.06]} /></mesh>
      <mesh position={[wcx, WIN.y0 + t / 2, z]} material={m.frame}><boxGeometry args={[winW, t, 0.06]} /></mesh>
      <mesh position={[WIN.x0 + t / 2, wcy, z]} material={m.frame}><boxGeometry args={[t, winH, 0.06]} /></mesh>
      <mesh position={[WIN.x1 - t / 2, wcy, z]} material={m.frame}><boxGeometry args={[t, winH, 0.06]} /></mesh>
      <mesh position={[wcx, wcy, z]} material={m.frame}><boxGeometry args={[0.045, winH, 0.06]} /></mesh>
      <mesh position={[wcx, 2.0, z]} material={m.frame}><boxGeometry args={[winW, 0.04, 0.06]} /></mesh>
      {/* the iron grille outside the glass, with its band of rings */}
      {bars.map((x) => (
        <mesh key={x} position={[x, wcy, WIN.zOut + 0.02]} material={m.iron}><boxGeometry args={[0.012, winH, 0.012]} /></mesh>
      ))}
      {[WIN.y0 + 0.06, WIN.y0 + 0.32, WIN.y1 - 0.22].map((y) => (
        <mesh key={y} position={[wcx, y, WIN.zOut + 0.02]} material={m.iron}><boxGeometry args={[winW, 0.012, 0.012]} /></mesh>
      ))}
      {/* the band of rings sits low, under the eye line */}
      {bars.slice(0, -1).map((x) => (
        <mesh key={x} position={[x + 0.0625, WIN.y0 + 0.19, WIN.zOut + 0.02]} material={m.iron}><torusGeometry args={[0.05, 0.0045, 6, 24]} /></mesh>
      ))}
    </group>
  );
}

function Curtain({ material }: { material: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.5, 1.6, 48, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 44) * 0.025);
    g.computeVertexNormals();
    g.translate(0, -0.8, 0); // hang from the top edge
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const fan = useRoom.getState().fan, t = clock.elapsedTime;
    ref.current.rotation.x = (Math.sin(t * 1.3) * 0.5 + Math.sin(t * 2.9) * 0.3) * 0.025 * fan;
  });
  return <mesh ref={ref} geometry={geo} material={material} position={[1.2, 2.49, -0.43]} castShadow receiveShadow />;
}

function Chair({ material }: { material: THREE.Material }) {
  const legs: [number, number][] = [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]];
  return (
    <group position={[0.12, 0, 0.72]} rotation-y={0.18}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={material}><boxGeometry args={[0.44, 0.03, 0.42]} /></mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.225, z]} castShadow material={material}><cylinderGeometry args={[0.017, 0.015, 0.45, 10]} /></mesh>
      ))}
      {[-0.19, 0.19].map((x) => (
        <mesh key={x} position={[x, 0.68, 0.19]} castShadow material={material}><cylinderGeometry args={[0.016, 0.016, 0.46, 10]} /></mesh>
      ))}
      <mesh position={[0, 0.88, 0.19]} castShadow material={material}><boxGeometry args={[0.44, 0.075, 0.025]} /></mesh>
      {[-0.08, 0, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.66, 0.19]} castShadow material={material}><boxGeometry args={[0.03, 0.36, 0.015]} /></mesh>
      ))}
    </group>
  );
}
