import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Everything in the room has softened edges, the way real furniture, books and trim do.

const boxes = new Map<string, RoundedBoxGeometry>();

/** a box with rounded edges: the radius follows the box's thinnest side, up to `max`. Shared, so don't dispose it. */
export function soft(w: number, h: number, d: number, max = 0.03) {
  const r = Math.min(max, Math.min(w, h, d) * 0.3);
  const key = `${w}|${h}|${d}|${r}`;
  let g = boxes.get(key);
  if (!g) boxes.set(key, (g = new RoundedBoxGeometry(w, h, d, 3, r)));
  return g;
}

/** a bent slat, like a plywood chair back: an arc `span` radians wide on radius `r`, `t` thick, `h` tall, standing
 * upright and bulging toward +z */
export function curvedSlat(r: number, t: number, span: number, h: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r + t, -span / 2, span / 2, false);
  s.absarc(0, 0, r, span / 2, -span / 2, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, curveSegments: 28, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3 });
  g.translate(0, 0, -h / 2);
  g.rotateX(-Math.PI / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
