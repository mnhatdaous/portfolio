"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "../lib/textures";

// The view: a hillside of autumn maples and firs running down to a lakeside town, the lake, and snowy mountains
// under soft streaks of cloud. It all sits within 215 m so depth stays precise; from that far, walking round the
// room moves it by under a degree, which reads as far away.

/** toward the sun: low in the front-left, an autumn afternoon */
export const SUN = new THREE.Vector3(-0.55, 0.5, -0.67).normalize();
const LAKE_Y = -14;
const SKY_R = 215;
const HAZE = "#dbe5ec";
/** shared by the foliage shaders, so the trees sway together */
const TIME = { value: 0 };

const NOISE = /* glsl */ `
  float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float hash12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float noise1(float x){ float i = floor(x), f = fract(x); return mix(hash11(i), hash11(i + 1.), f * f * (3. - 2. * f)); }
  float noise2(vec2 p){
    vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise2(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; } return v; }
`;
const VERT_WORLD = /* glsl */ `
  varying vec3 vPos;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;

const col = (hex: string) => ({ value: new THREE.Color(hex) });

/** the ground: the house stands at the top of a bluff; below it the hillside runs down to the shore at about 100 m */
export function groundY(x: number, z: number) {
  const r = Math.hypot(x, z), a = Math.atan2(x, -z);
  const bumps = Math.sin(a * 5 + r * 0.05) * 0.8 + Math.sin(a * 13 - r * 0.11) * 0.4;
  const t = THREE.MathUtils.smoothstep(r, 5, 20);
  return -2 - 7.5 * t - 4.5 * THREE.MathUtils.clamp((r - 20) / 80, 0, 1) + bumps * Math.min(1, r / 25);
}

// ---------------------------------------------------------------- the sky
function Sky() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: TIME, uSun: { value: SUN },
      uZenith: col("#5d90cc"), uMid: col("#9bbfe2"), uHorizon: col("#e2eaef"),
      uCloud: col("#ffffff"), uCloudShade: col("#c3cede"),
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime; uniform vec3 uSun, uZenith, uMid, uHorizon, uCloud, uCloudShade;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float e = max(d.y, 0.);
        vec3 c = mix(uHorizon, uMid, smoothstep(.0, .22, e));
        c = mix(c, uZenith, smoothstep(.2, .8, e));
        float s = max(dot(d, uSun), 0.);
        c += vec3(1., .86, .64) * (pow(s, 5.) * .14 + pow(s, 40.) * .3);
        // streaks of cloud on a layer overhead, bunching up toward the horizon
        vec2 p = d.xz / (e + .08);
        p.x += uTime * .005;
        vec2 q = p * vec2(.3, 1.2);
        float n = fbm(q + fbm(q * .7 + 3.1) * 1.3);
        float cover = smoothstep(.54, .74, n) * smoothstep(.0, .07, e);
        // thick parts are grey-blue underneath; thin edges and the sun's side are bright
        vec3 cloud = mix(uCloud, uCloudShade, smoothstep(.62, .86, n) * (1. - s * .5));
        cloud = mix(cloud, uHorizon, (1. - smoothstep(.0, .14, e)) * .55);
        c = mix(c, cloud, cover);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  }), []);
  return <mesh material={mat}><sphereGeometry args={[SKY_R, 64, 32]} /></mesh>;
}

// ---------------------------------------------------------------- mountains and hills: ridgelines on cylinders
type RidgeDef = { r: number; amp: number; freq: number; jag: number; seed: number; snow?: number; lit: string; shade: string; haze: number; forest?: number; sides?: number };
const RIDGES: RidgeDef[] = [
  // the snowy range across the lake
  { r: 205, amp: 44, freq: 1.8, jag: 0.85, seed: 3, snow: 6, lit: "#9aabc4", shade: "#56678a", haze: 0.06 },
  // forested hills on the far shore
  { r: 193, amp: 12, freq: 3.6, jag: 0.15, seed: 11, lit: "#6d8784", shade: "#465e5f", haze: 0.16, forest: 1 },
  // nearer hills that close the view in at either side
  { r: 150, amp: 36, freq: 2.2, jag: 0.25, seed: 23, lit: "#7f8b55", shade: "#4c5c3a", haze: 0.14, forest: 1, sides: 1 },
];

function Ridge({ d }: { d: RidgeDef }) {
  const base = LAKE_Y - 1, H = d.amp + 2;
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: base }, uAmp: { value: d.amp }, uFreq: { value: d.freq }, uJag: { value: d.jag }, uSeed: { value: d.seed },
      uSnow: { value: d.snow ?? 999 }, uHaze: { value: d.haze }, uForest: { value: d.forest ?? 0 }, uSides: { value: d.sides ?? 0 },
      uLit: col(d.lit), uShade: col(d.shade), uSnowLit: col("#eef2f7"), uSnowShade: col("#b6c3d6"), uHazeC: col(HAZE),
    },
    vertexShader: VERT_WORLD,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uBase, uAmp, uFreq, uJag, uSeed, uSnow, uHaze, uForest, uSides;
      uniform vec3 uLit, uShade, uSnowLit, uSnowShade, uHazeC;
      varying vec3 vPos;
      float ridge(float x, int octaves){
        float h = 0., a = .55, f = 1.;
        for (int i = 0; i < 6; i++){
          if (i >= octaves) break;
          float n = noise1(x * f + uSeed + float(i) * 13.7);
          float r = 1. - abs(n * 2. - 1.);
          h += mix(n, r * r, uJag) * a;
          f *= 2.03; a *= .46;
        }
        return h;
      }
      float heightAt(float az, int octaves){
        float side = mix(1., smoothstep(.45, 1.25, abs(az)), uSides);
        return uBase + uAmp * ridge(az * uFreq, octaves) * side;
      }
      void main(){
        float az = atan(vPos.x, -vPos.z);
        float h = heightAt(az, 6), y = vPos.y;
        if (y > h) discard;
        float rr = length(vPos.xz), dA = 5. / rr;
        // light: near the ridgeline it follows the ridge's slope (the sun is to the left, so faces that rise to the
        // right look toward it); further down it follows the folds of the mountainside
        float slope = (heightAt(az + dA, 3) - heightAt(az - dA, 3)) / 10.;
        float ridgeLit = .5 + slope * 1.4;
        // spurs run down the faces: noise stretched tall, lit on the side toward the sun
        vec2 q = vec2(az * rr * .07, y * .022);
        float fold = fbm(q + vec2(.2, 0.)) - fbm(q - vec2(.2, 0.));
        float faceLit = .5 + fold * 2.6 + (fbm(q * 3.1) - .5) * .2;
        float lit = clamp(mix(faceLit, ridgeLit, .7 * exp(-(h - y) / (uAmp * .2))), 0., 1.);
        vec3 c = mix(uShade, uLit, lit);
        c *= 1. - uForest * smoothstep(.5, .8, fbm(vec2(az * rr * .4, y * .45))) * .3;
        // snow on the upper slopes: the snowline wanders along the range and reaches down the gullies
        float line = uSnow + (fbm(vec2(az * rr * .02, 3.)) - .5) * 12.;
        float gully = fbm(vec2(az * rr * .1, y * .05));
        float snow = smoothstep(line - 1.5, line + 1.5, y + (gully - .5) * 12.) * smoothstep(.0, .35, lit + .2);
        // a peak that only just clears the snowline gets a dusting, not a white rim
        snow *= smoothstep(1., 7., h - line);
        c = mix(c, mix(uSnowShade, uSnowLit, lit), snow);
        // haze, thicker low down where the air over the lake is
        float low = 1. - smoothstep(uBase, uBase + uAmp * .45, y);
        c = mix(c, uHazeC, clamp(uHaze + low * .28, 0., 1.));
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  }), [d, base]);
  return (
    <mesh position={[0, base + H / 2, 0]} material={mat}>
      <cylinderGeometry args={[d.r, d.r, H, 512, 1, true]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- the lake
function Lake() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: TIME, uSun: { value: SUN }, uNear: col("#7ea5c6"), uFar: col("#c3d6e6"), uShore: col("#7f9497"), uGlint: { value: new THREE.Color(1, 0.96, 0.86) } },
    vertexShader: VERT_WORLD,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime; uniform vec3 uSun, uNear, uFar, uShore, uGlint;
      varying vec3 vPos;
      void main(){
        float r = length(vPos.xz);
        vec3 c = mix(uNear, uFar, smoothstep(95., 200., r));
        // the far shore's hills mirrored in the water, a darker band under them
        c = mix(c, uShore, smoothstep(168., 196., r) * .5);
        // long, slow ripples
        float rip = noise2(vec2(vPos.x * .045, vPos.z * .55 + uTime * .12));
        c *= .95 + rip * .1;
        // the sun glitters on the water, most where it would reflect
        vec3 v = normalize(vPos - cameraPosition);
        float g = pow(max(dot(reflect(v, vec3(0., 1., 0.)), uSun), 0.), 10.);
        vec2 cell = floor(vPos.xz * vec2(.45, 2.));
        float tw = step(.993 - g * .04, hash12(cell + floor(uTime * 2. + hash12(cell) * 9.)));
        c += uGlint * tw * (.35 + g * 2.2);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  }), []);
  return (
    <mesh position={[0, LAKE_Y, 0]} rotation-x={-Math.PI / 2} material={mat}>
      <circleGeometry args={[210, 96]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- the hillside
function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(3.2, 112, 180, 60);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, colors = new Float32Array(p.count * 3), r = rng(5);
    const tones = ["#6e7d3e", "#7f7c3c", "#5f6c36", "#8c7a3f", "#6c6834", "#74843f"].map((h) => new THREE.Color(h));
    for (let i = 0; i < p.count; i++) {
      p.setY(i, groundY(p.getX(i), p.getZ(i)));
      const c = tones[Math.floor(r() * tones.length)];
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  return <mesh geometry={geo} material={mat} />;
}

// ---------------------------------------------------------------- the town on the shore
function Town() {
  const meshes = useMemo(() => {
    const r = rng(77);
    const walls = ["#f4f2ed", "#ebe6dc", "#f6efe2", "#e3e6e9", "#efe3d0"].map((h) => new THREE.Color(h));
    const roofs = ["#4b5058", "#5d4a42", "#3e4652", "#8a4b3a", "#62676e"].map((h) => new THREE.Color(h));
    const spots: { x: number; z: number; w: number; d: number; h: number; yaw: number; wall: THREE.Color; roof: THREE.Color }[] = [];
    for (let k = 0; k < 4000 && spots.length < 460; k++) {
      const a = -0.85 + r() * 1.95, rad = 48 + r() * 50;
      // the old town by the shore, right of centre, and a few streets up the hill on the left
      const dens = Math.exp(-((a - 0.25) ** 2) / 0.09) + 0.55 * Math.exp(-((a + 0.5) ** 2) / 0.04) + 0.1;
      if (r() > dens * 0.8) continue;
      const x = Math.sin(a) * rad, z = -Math.cos(a) * rad;
      if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 9)) continue;
      const big = r() < 0.1;
      spots.push({
        x, z, yaw: a + (r() - 0.5) * 0.5,
        w: big ? 3.4 + r() * 1.6 : 1.5 + r() * 1.3, d: big ? 3 + r() * 1.4 : 1.4 + r() * 1.1, h: big ? 2.6 + r() * 1.8 : 1.1 + r() * 1,
        wall: walls[Math.floor(r() * walls.length)], roof: roofs[Math.floor(r() * roofs.length)],
      });
    }
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    const box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, spots.length);
    const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), mat, spots.length);
    const o = new THREE.Object3D();
    spots.forEach((s, i) => {
      const y = groundY(s.x, s.z) - 0.25;
      o.position.set(s.x, y, s.z);
      o.rotation.set(0, s.yaw, 0);
      o.scale.set(s.w, s.h, s.d);
      o.updateMatrix();
      box.setMatrixAt(i, o.matrix);
      box.setColorAt(i, s.wall);
      o.position.y = y + s.h;
      o.scale.set(s.w * 1.08, Math.min(s.w, s.d) * 0.45, s.d * 1.08);
      o.updateMatrix();
      roof.setMatrixAt(i, o.matrix);
      roof.setColorAt(i, s.roof);
    });
    return [box, roof];
  }, []);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// ---------------------------------------------------------------- trees: firs, and maples turning
/** Lambert with a leafy speckle and a slow sway; the sway and the speckle use the instance's position */
function foliage(sway: number, leaf: number) {
  const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
  const uSway = { value: sway }, uLeafScale = { value: leaf };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uTime: TIME, uSway, uLeafScale });
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime, uSway, uLeafScale;\nvarying vec3 vLeaf;")
      .replace("#include <begin_vertex>", /* glsl */ `#include <begin_vertex>
        vec3 ip = instanceMatrix[3].xyz;
        float ph = ip.x * .37 + ip.z * .23;
        transformed += vec3(sin(uTime * 1.3 + ph), 0., cos(uTime * 1.05 + ph * 1.3)) * uSway * (position.y + 1.);
        vLeaf = ip * .21 + position * uLeafScale;`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", /* glsl */ `#include <common>
        varying vec3 vLeaf;
        float lh(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float ln(vec3 x){
          vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
          return mix(mix(mix(lh(i), lh(i + vec3(1., 0., 0.)), f.x), mix(lh(i + vec3(0., 1., 0.)), lh(i + vec3(1., 1., 0.)), f.x), f.y),
                     mix(mix(lh(i + vec3(0., 0., 1.)), lh(i + vec3(1., 0., 1.)), f.x), mix(lh(i + vec3(0., 1., 1.)), lh(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
        }`)
      .replace("#include <color_fragment>", /* glsl */ `#include <color_fragment>
        float leaf = ln(vLeaf * 4.) * .55 + ln(vLeaf * 10.) * .45;
        diffuseColor.rgb *= .58 + .75 * leaf;`);
  };
  m.customProgramCacheKey = () => "foliage";
  return m;
}

type Tree = { a: number; r: number; h: number; kind: "fir" | "maple"; crown?: number };
// the trees that frame the window, placed by hand: tall firs either side, a big maple below, a little left of centre
const FRAMING: Tree[] = [
  { a: -0.78, r: 15, h: 20, kind: "fir" }, { a: -1.12, r: 14, h: 16, kind: "fir" }, { a: -0.58, r: 25, h: 17, kind: "fir" },
  { a: -1.5, r: 19, h: 7, kind: "maple" }, { a: -1.82, r: 19, h: 16, kind: "fir" },
  { a: 0.72, r: 16, h: 21, kind: "fir" }, { a: 1.05, r: 14.5, h: 17, kind: "fir" }, { a: 0.5, r: 28, h: 16, kind: "fir" },
  { a: 1.42, r: 19, h: 7, kind: "maple" }, { a: 1.78, r: 18, h: 15, kind: "fir" },
  { a: -0.22, r: 21, h: 8, kind: "maple", crown: 1.35 }, { a: 0.18, r: 25, h: 7, kind: "maple" }, { a: 0.02, r: 18, h: 6, kind: "maple" },
];
const MAPLE = ["#d9822b", "#e6a640", "#c0602a", "#e8c35a", "#cf7a2e", "#b9552c", "#9aa54a", "#d99a3a"].map((h) => new THREE.Color(h));
const FIR = ["#2e4a3b", "#34523f", "#294236", "#3a5a44"].map((h) => new THREE.Color(h));
const EYE_Y = 1.42;

/** in front of the window, trees stay below the line of the far shore so the view stays open */
function maxHeight(a: number, r: number, ground: number) {
  if (Math.abs(a) > 0.6 || r > 50) return Infinity;
  return EYE_Y - r * Math.tan(0.14) - ground;
}

function Trees() {
  const meshes = useMemo(() => {
    const r = rng(41);
    const trees: Tree[] = [...FRAMING];
    // the rest of the hillside: thicker at the sides, thinning out among the houses
    for (let k = 0; k < 1200 && trees.length < 300; k++) {
      const a = (r() - 0.5) * 3.9, rad = 13 + r() * 85;
      const side = Math.min(1, Math.abs(a) / 0.9);
      if (r() > 0.3 + side * 0.55 - (rad > 45 ? 0.12 : 0)) continue;
      const x = Math.sin(a) * rad, z = -Math.cos(a) * rad;
      if (trees.some((t) => (Math.sin(t.a) * t.r - x) ** 2 + (-Math.cos(t.a) * t.r - z) ** 2 < (rad < 30 ? 20 : 26))) continue;
      const fir = r() < (rad > 45 ? 0.6 : 0.42);
      const cap = maxHeight(a, rad, groundY(x, z));
      const h = Math.min(cap, fir ? 8 + r() * 11 : 5 + r() * 4);
      if (h < 3.5) continue;
      trees.push({ a, r: rad, kind: fir ? "fir" : "maple", h });
    }

    const o = new THREE.Object3D();
    const firs = trees.filter((t) => t.kind === "fir"), maples = trees.filter((t) => t.kind === "maple");
    // a fir: four stacked cones on a trunk, one unit tall
    const firGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.03, 0.045, 0.2, 6).translate(0, 0.1, 0),
      ...[0, 1, 2, 3].map((k) => new THREE.ConeGeometry(0.42 - k * 0.085, 0.4 - k * 0.04, 12, 1).translate(0, 0.27 + k * 0.19, 0)),
    ])!;
    const firMesh = new THREE.InstancedMesh(firGeo, foliage(0.004, 2.6), firs.length);
    firs.forEach((t, i) => {
      const x = Math.sin(t.a) * t.r, z = -Math.cos(t.a) * t.r;
      o.position.set(x, groundY(x, z) - 0.3, z);
      o.rotation.set((r() - 0.5) * 0.05, r() * 6.28, (r() - 0.5) * 0.05);
      o.scale.set(t.h * 0.3, t.h, t.h * 0.3);
      o.updateMatrix();
      firMesh.setMatrixAt(i, o.matrix);
      firMesh.setColorAt(i, FIR[Math.floor(r() * FIR.length)].clone().offsetHSL(0, 0, (r() - 0.5) * 0.04));
    });

    // a maple: a trunk, and a crown of small lumpy blobs
    const blobGeo = (() => {
      const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2));
      const p = g.attributes.position, v = new THREE.Vector3(), q = rng(8);
      const bumps = Array.from({ length: 7 }, () => new THREE.Vector3(q() - 0.5, q() - 0.5, q() - 0.5).normalize());
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const k = bumps.reduce((s, b) => s + Math.max(0, v.dot(b)) ** 6 * 0.22, 0);
        v.multiplyScalar(1 + k);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    })();
    const blobs: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const trunks: THREE.Matrix4[] = [];
    maples.forEach((t) => {
      const x = Math.sin(t.a) * t.r, z = -Math.cos(t.a) * t.r, y0 = groundY(x, z) - 0.3;
      const crown = t.h * 0.3 * (t.crown ?? 1), cy = y0 + t.h - crown;
      o.position.set(x, y0, z);
      o.rotation.set(0, 0, 0);
      o.scale.set(t.h * 0.03, t.h * 0.7, t.h * 0.03);
      o.updateMatrix();
      trunks.push(o.matrix.clone());
      const base = MAPLE[Math.floor(r() * MAPLE.length)];
      const n = 16 + Math.floor(r() * 10);
      for (let k = 0; k < n; k++) {
        const u = r() * Math.PI * 2, w = Math.acos(1 - r() * 1.7), s = 0.5 + r() * 0.5;
        o.position.set(x + Math.sin(w) * Math.cos(u) * crown * s, cy + Math.cos(w) * crown * 0.75 * s, z + Math.sin(w) * Math.sin(u) * crown * s);
        o.rotation.set(r() * 6, r() * 6, r() * 6);
        o.scale.setScalar(crown * (0.3 + r() * 0.16));
        o.updateMatrix();
        blobs.push({ m: o.matrix.clone(), c: base.clone().offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.09) });
      }
    });
    const mapleMesh = new THREE.InstancedMesh(blobGeo, foliage(0.03, 1.6), blobs.length);
    blobs.forEach((b, i) => { mapleMesh.setMatrixAt(i, b.m); mapleMesh.setColorAt(i, b.c); });
    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.7, 1, 1, 7).translate(0, 0.5, 0),
      new THREE.MeshLambertMaterial({ color: "#4a3a2e" }),
      trunks.length,
    );
    trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
    return [firMesh, mapleMesh, trunkMesh];
  }, []);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

export default function Outside() {
  useFrame(({ clock }) => { TIME.value = clock.elapsedTime; });
  return (
    <group>
      <Sky />
      {RIDGES.map((d) => <Ridge key={d.seed} d={d} />)}
      <Lake />
      <Ground />
      <Town />
      <Trees />
    </group>
  );
}
