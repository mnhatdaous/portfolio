import * as THREE from "three";

// Soft shapes, like upholstery, are easiest to describe as a signed distance: for any point, how far it is from the
// surface, negative inside. `surfaceNets` turns one into a mesh. Space is cut into little cubes; each cube the surface
// passes through gets one vertex, where the surface crosses the cube's edges on average, pulled onto the surface, and
// each cube edge the surface crosses becomes a quad between the four cubes around it. Normals come from the shape
// itself, so the shading is as smooth as the shape. Cubes far from the surface are skipped in blocks.

/** a signed distance in metres: negative inside, positive outside */
export type SDF = (x: number, y: number, z: number) => number;

/** smooth union: the two shapes flow into each other over about `k`, like a seam pulled tight */
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** a 2D isosceles trapezoid round the origin: half as wide as `r1` at the bottom (y = -he) and `r2` at the top */
export function sdTrapezoid(px: number, py: number, r1: number, r2: number, he: number) {
  const k2x = r2 - r1, k2y = 2 * he;
  px = Math.abs(px);
  const cax = px - Math.min(px, py < 0 ? r1 : r2), cay = Math.abs(py) - he;
  const t = Math.min(1, Math.max(0, ((r2 - px) * k2x + (he - py) * k2y) / (k2x * k2x + k2y * k2y)));
  const cbx = px - r2 + k2x * t, cby = py - he + k2y * t;
  const s = cbx < 0 && cay < 0 ? -1 : 1;
  return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
}

/** a 2D box of half-size (bx, by) round the origin, each corner rounded on its own radius: [+x+y, +x-y, -x+y, -x-y] */
export function sdRoundBox(px: number, py: number, bx: number, by: number, r: readonly [number, number, number, number]) {
  const rr = px > 0 ? (py > 0 ? r[0] : r[1]) : py > 0 ? r[2] : r[3];
  const qx = Math.abs(px) - bx + rr, qy = Math.abs(py) - by + rr;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - rr;
}

const CORNER = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1];
const EDGE = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];

/**
 * Mesh `f` inside `box` ([x0, y0, z0, x1, y1, z1], with a little room round the shape) on cubes `h` wide. Triangles
 * whose corners are all inside `hidden` (another solid this one tucks into) are left out.
 */
export function surfaceNets(f: SDF, box: readonly number[], h: number, hidden?: SDF) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const B = 4; // cubes per block, along each side
  const nx = Math.ceil((x1 - x0) / (h * B)) * B, ny = Math.ceil((y1 - y0) / (h * B)) * B, nz = Math.ceil((z1 - z0) / (h * B)) * B;
  const sx = nx + 1, sxy = sx * (ny + 1);
  const val = new Float32Array(sxy * (nz + 1));
  const done = new Uint8Array(val.length);
  // a block whose middle is farther from the surface than its corners are from its middle can't hold any of it
  // (with room to spare, since the shapes' distances are only nearly exact)
  const reach = 1.5 * ((h * B * Math.sqrt(3)) / 2) + 2 * h;
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const d = f(x0 + (bi + B / 2) * h, y0 + (bj + B / 2) * h, z0 + (bk + B / 2) * h);
    const near = Math.abs(d) <= reach;
    for (let k = bk; k <= bk + B; k++) for (let j = bj; j <= bj + B; j++) for (let i = bi; i <= bi + B; i++) {
      const at = i + sx * j + sxy * k;
      if (done[at] === 2) continue;
      if (near) {
        val[at] = f(x0 + i * h, y0 + j * h, z0 + k * h);
        done[at] = 2;
      } else if (!done[at]) {
        val[at] = d > 0 ? 1 : -1;
        done[at] = 1;
      }
    }
  }

  // the gradient by four samples round a tetrahedron; their average is the distance itself, near enough
  const e = h * 0.05, g = [0, 0, 0, 0];
  const probe = (x: number, y: number, z: number) => {
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), dd = f(x + e, y + e, z + e);
    g[0] = (a - b - c + dd) / (4 * e);
    g[1] = (-a - b + c + dd) / (4 * e);
    g[2] = (-a + b - c + dd) / (4 * e);
    g[3] = (a + b + c + dd) / 4;
  };

  const cell = new Int32Array(nx * ny * nz).fill(-1);
  const P: number[] = [], N: number[] = [];
  const v = new Float64Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      v[c] = val[i + CORNER[c * 3] + sx * (j + CORNER[c * 3 + 1]) + sxy * (k + CORNER[c * 3 + 2])];
      if (v[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (let q = 0; q < 24; q += 2) {
      const a = EDGE[q], b = EDGE[q + 1];
      if (v[a] < 0 === v[b] < 0) continue;
      const t = v[a] / (v[a] - v[b]);
      px += CORNER[a * 3] + t * (CORNER[b * 3] - CORNER[a * 3]);
      py += CORNER[a * 3 + 1] + t * (CORNER[b * 3 + 1] - CORNER[a * 3 + 1]);
      pz += CORNER[a * 3 + 2] + t * (CORNER[b * 3 + 2] - CORNER[a * 3 + 2]);
      n++;
    }
    let x = x0 + (i + px / n) * h, y = y0 + (j + py / n) * h, z = z0 + (k + pz / n) * h;
    // one Newton step onto the surface, never more than a cube's width
    probe(x, y, z);
    const gg = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
    if (gg > 1e-12) {
      let s = g[3] / gg;
      const len = Math.abs(s) * Math.sqrt(gg);
      if (len > h) s *= h / len;
      x -= g[0] * s;
      y -= g[1] * s;
      z -= g[2] * s;
      probe(x, y, z);
    }
    const gl = Math.hypot(g[0], g[1], g[2]);
    cell[i + nx * (j + ny * k)] = P.length / 3;
    P.push(x, y, z);
    // never a zero normal: the shader would normalise it to NaN
    if (gl > 1e-9) N.push(g[0] / gl, g[1] / gl, g[2] / gl);
    else N.push(0, 1, 0);
  }

  const hid = hidden ? Uint8Array.from({ length: P.length / 3 }, (_, q) => (hidden(P[q * 3], P[q * 3 + 1], P[q * 3 + 2]) < -0.003 ? 1 : 0)) : null;
  const I: number[] = [];
  const C = (i: number, j: number, k: number) => cell[i + nx * (j + ny * k)];
  const d2 = (a: number, b: number) => (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;
  const tri = (a: number, b: number, c: number) => {
    if (hid && hid[a] && hid[b] && hid[c]) return;
    I.push(a, b, c);
  };
  // a quad a-b-c-d, counter-clockwise seen from outside; split along its shorter diagonal
  const quad = (a: number, b: number, c: number, d: number, out: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (!out) [b, d] = [d, b];
    if (d2(a, c) <= d2(b, d)) {
      tri(a, b, c);
      tri(a, c, d);
    } else {
      tri(a, b, d);
      tri(b, c, d);
    }
  };
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const at = i + sx * j + sxy * k, inside = val[at] < 0;
    if (i < nx && j > 0 && j < ny && k > 0 && k < nz && inside !== val[at + 1] < 0)
      quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), inside);
    if (j < ny && i > 0 && i < nx && k > 0 && k < nz && inside !== val[at + sx] < 0)
      quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), inside);
    if (k < nz && i > 0 && i < nx && j > 0 && j < ny && inside !== val[at + sxy] < 0)
      quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), inside);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  geo.setIndex(I);
  geo.computeBoundingSphere();
  return geo;
}
