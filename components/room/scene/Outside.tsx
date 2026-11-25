"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { SKY, U, useSeason, type Season } from "../lib/sky";
import { rng } from "../lib/textures";

// The view: a hillside of maples and firs running down to a lakeside town, the lake, and snowy mountains under soft
// streaks of cloud. It keeps the room's time and season (lib/sky.ts): through the day the sky, the light on the
// mountains and the lake change, at night the stars and the moon come out and the town's windows light up; through
// the year the maples and the hillside change, snow comes down the mountains in winter, and the air carries snow,
// falling leaves, blossom or, on summer nights, fireflies. It all sits within 215 m so depth stays precise; from that
// far, walking round the room moves it by under a degree, which reads as far away.

/** toward the sun, wherever the time of day has it */
export const SUN = SKY.sun;
const LAKE_Y = -14;
const SKY_R = 215;
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
      uTime: TIME, uSun: { value: SKY.sun }, uMoon: { value: SKY.moon }, uLit: { value: SKY.light },
      uZenith: { value: SKY.zenith }, uMid: { value: SKY.mid }, uHorizon: { value: SKY.horizon },
      uCloud: { value: SKY.cloud }, uCloudShade: { value: SKY.cloudShade }, uGlow: { value: SKY.glow },
      uGlowK: U.glowK, uStars: U.stars, uSunVis: U.sunVis, uMoonVis: U.moonVis,
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime, uGlowK, uStars, uSunVis, uMoonVis;
      uniform vec3 uSun, uMoon, uLit, uZenith, uMid, uHorizon, uCloud, uCloudShade, uGlow;
      varying vec3 vDir;
      float hash13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      void main(){
        vec3 d = normalize(vDir);
        float e = max(d.y, 0.);
        vec3 c = mix(uHorizon, uMid, smoothstep(.0, .22, e));
        c = mix(c, uZenith, smoothstep(.2, .8, e));
        // stars, fewer toward the horizon, each twinkling at its own pace
        vec3 sp = d * 260.;
        float sh = hash13(floor(sp));
        float star = step(.995, sh) * smoothstep(.42, .06, length(fract(sp) - .5)) * (.6 + .4 * sin(uTime * (1.3 + sh * 3.) + sh * 70.));
        c += vec3(1., .97, .9) * star * uStars * smoothstep(.015, .12, e) * (.45 + (sh - .995) * 200.);
        // the moon, its darker seas, and a halo round it
        float m = dot(d, uMoon);
        vec3 t1 = normalize(cross(uMoon, vec3(0., 1., .001))), t2 = cross(t1, uMoon);
        float seas = fbm(vec2(dot(d, t1), dot(d, t2)) * 70. + 4.);
        c = mix(c, vec3(.97, .95, .88) * (.78 + .3 * smoothstep(.35, .7, seas)), smoothstep(.99925, .99942, m) * uMoonVis);
        c += vec3(.5, .58, .78) * pow(max(m, 0.), 500.) * .5 * uMoonVis;
        // the glow round the sun, and along the horizon on its side as it rises and sets, and the sun itself
        float s = max(dot(d, uSun), 0.);
        c += uGlow * (pow(s, 5.) * .14 + pow(s, 40.) * .3) * uSunVis;
        float toward = max(dot(normalize(d.xz + vec2(1e-4)), normalize(uSun.xz + vec2(1e-4))), 0.);
        c += uGlow * uGlowK * pow(toward, 3.) * (1. - smoothstep(.0, .4, e));
        c = mix(c, max(uGlow, vec3(.85)) * 1.6, smoothstep(.99955, .99972, s) * uSunVis);
        // streaks of cloud on a layer overhead, bunching up toward the horizon
        vec2 p = d.xz / (e + .08);
        p.x += uTime * .005;
        vec2 q = p * vec2(.3, 1.2);
        float n = fbm(q + fbm(q * .7 + 3.1) * 1.3);
        float cover = smoothstep(.54, .74, n) * smoothstep(.0, .07, e);
        // thick parts are darker underneath; thin edges and the side toward the light are bright
        float l = max(dot(d, uLit), 0.);
        vec3 cloud = mix(uCloud, uCloudShade, smoothstep(.62, .86, n) * (1. - l * .5));
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
type RidgeSeason = { lit?: string; shade?: string; snow?: number };
const RIDGES: RidgeDef[] = [
  // the snowy range across the lake
  { r: 205, amp: 44, freq: 1.8, jag: 0.85, seed: 3, snow: 6, lit: "#9aabc4", shade: "#56678a", haze: 0.06 },
  // forested hills on the far shore
  { r: 193, amp: 12, freq: 3.6, jag: 0.15, seed: 11, lit: "#6d8784", shade: "#465e5f", haze: 0.16, forest: 1 },
  // nearer hills that close the view in at either side
  { r: 150, amp: 36, freq: 2.2, jag: 0.25, seed: 23, lit: "#7f8b55", shade: "#4c5c3a", haze: 0.14, forest: 1, sides: 1 },
];
/** what the seasons do to each ridge: the snowline comes down in winter and goes up in summer, the hills turn green
 * in spring and summer, white under the trees in winter */
const RIDGE_SEASON: Record<Season, RidgeSeason[]> = {
  autumn: [{}, {}, {}],
  spring: [{ snow: 9 }, { lit: "#6f8f78", shade: "#46624f" }, { lit: "#7f9f55", shade: "#4f6a37" }],
  summer: [{ snow: 17 }, { lit: "#5f8370", shade: "#3d5a4a" }, { lit: "#5e8a3e", shade: "#3a5a2a" }],
  winter: [{ snow: -4 }, { snow: -40, lit: "#7d8f8c", shade: "#4c5d5d" }, { snow: -40, lit: "#86927c", shade: "#526050" }],
};

function Ridge({ d, season }: { d: RidgeDef; season: Season }) {
  const base = LAKE_Y - 1, H = d.amp + 2;
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: base }, uAmp: { value: d.amp }, uFreq: { value: d.freq }, uJag: { value: d.jag }, uSeed: { value: d.seed },
      uSnow: { value: d.snow ?? 999 }, uHaze: { value: d.haze }, uForest: { value: d.forest ?? 0 }, uSides: { value: d.sides ?? 0 },
      uLit: col(d.lit), uShade: col(d.shade), uSnowLit: col("#eef2f7"), uSnowShade: col("#b6c3d6"),
      uHazeC: { value: SKY.haze }, uTint: { value: SKY.tint }, uSide: U.side,
    },
    vertexShader: VERT_WORLD,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uBase, uAmp, uFreq, uJag, uSeed, uSnow, uHaze, uForest, uSides, uSide;
      uniform vec3 uLit, uShade, uSnowLit, uSnowShade, uHazeC, uTint;
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
        // light: near the ridgeline it follows the ridge's slope (with the light on the left, faces that rise to the
        // right look toward it; uSide turns that round when it's on the right, and flattens it at noon); further down
        // it follows the folds of the mountainside
        float slope = (heightAt(az + dA, 3) - heightAt(az - dA, 3)) / 10.;
        float ridgeLit = .5 + slope * 1.4 * uSide;
        // spurs run down the faces: noise stretched tall, lit on the side toward the sun
        vec2 q = vec2(az * rr * .07, y * .022);
        float fold = fbm(q + vec2(.2, 0.)) - fbm(q - vec2(.2, 0.));
        float faceLit = .5 + fold * 2.6 * uSide + (fbm(q * 3.1) - .5) * .2;
        float lit = clamp(mix(faceLit, ridgeLit, .7 * exp(-(h - y) / (uAmp * .2))), 0., 1.);
        vec3 c = mix(uShade, uLit, lit);
        float trees = smoothstep(.5, .8, fbm(vec2(az * rr * .4, y * .45)));
        c *= 1. - uForest * trees * .3;
        // snow on the upper slopes: the snowline wanders along the range and reaches down the gullies
        float line = uSnow + (fbm(vec2(az * rr * .02, 3.)) - .5) * 12.;
        float gully = fbm(vec2(az * rr * .1, y * .05));
        float snow = smoothstep(line - 1.5, line + 1.5, y + (gully - .5) * 12.) * smoothstep(.0, .35, lit + .2);
        // a peak that only just clears the snowline gets a dusting, not a white rim
        snow *= smoothstep(1., 7., h - line);
        // on the wooded hills the trees stand dark out of the snow
        snow *= 1. - uForest * smoothstep(.45, .75, trees) * .75;
        c = mix(c, mix(uSnowShade, uSnowLit, lit), snow);
        // the light of the hour: warm at sunrise and sunset, dark blue at night
        c *= uTint;
        // haze, thicker low down where the air over the lake is
        float low = 1. - smoothstep(uBase, uBase + uAmp * .45, y);
        c = mix(c, uHazeC, clamp(uHaze + low * .28, 0., 1.));
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  }), [d, base]);
  useEffect(() => {
    const k = RIDGE_SEASON[season][RIDGES.indexOf(d)] ?? {};
    mat.uniforms.uLit.value.set(k.lit ?? d.lit);
    mat.uniforms.uShade.value.set(k.shade ?? d.shade);
    mat.uniforms.uSnow.value = k.snow ?? d.snow ?? 999;
  }, [mat, d, season]);
  return (
    <mesh position={[0, base + H / 2, 0]} material={mat}>
      <cylinderGeometry args={[d.r, d.r, H, 512, 1, true]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- the lake
/** the lake's colour in each season: a touch colder in winter */
const LAKE_SEASON: Record<Season, [number, number, number]> = { spring: [1, 1, 1], summer: [0.97, 1, 1.02], autumn: [1, 1, 1], winter: [0.9, 0.96, 1.06] };

function Lake({ season }: { season: Season }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: TIME, uLit: { value: SKY.light }, uNear: { value: SKY.near }, uFar: { value: SKY.far }, uShore: { value: SKY.shore },
      uGlint: { value: SKY.glint }, uGlintK: U.glintK, uDay: U.day, uSeason: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: VERT_WORLD,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime, uGlintK, uDay; uniform vec3 uLit, uNear, uFar, uShore, uGlint, uSeason;
      varying vec3 vPos;
      void main(){
        float r = length(vPos.xz);
        vec3 c = mix(uNear, uFar, smoothstep(95., 200., r)) * uSeason;
        // the far shore's hills mirrored in the water, a darker band under them
        c = mix(c, uShore, smoothstep(168., 196., r) * .5);
        // long, slow ripples
        float rip = noise2(vec2(vPos.x * .045, vPos.z * .55 + uTime * .12));
        c *= .95 + rip * .1;
        // the sun (or at night the moon) glitters on the water, most where it would reflect
        vec3 v = normalize(vPos - cameraPosition);
        float g = pow(max(dot(reflect(v, vec3(0., 1., 0.)), uLit), 0.), 10.);
        vec2 cell = floor(vPos.xz * vec2(.45, 2.));
        float tw = step(.993 - g * .04, hash12(cell + floor(uTime * 2. + hash12(cell) * 9.)));
        c += uGlint * tw * (.35 * uDay + g * 2.2) * uGlintK;
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  }), []);
  useEffect(() => { mat.uniforms.uSeason.value.setRGB(...LAKE_SEASON[season]); }, [mat, season]);
  return (
    <mesh position={[0, LAKE_Y, 0]} rotation-x={-Math.PI / 2} material={mat}>
      <circleGeometry args={[210, 96]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- the hillside
const GROUND: Record<Season, string[]> = {
  autumn: ["#6e7d3e", "#7f7c3c", "#5f6c36", "#8c7a3f", "#6c6834", "#74843f"],
  spring: ["#6f8f42", "#78984a", "#668a3d", "#80a04f", "#62843a", "#719748"],
  summer: ["#557d35", "#5d853a", "#4e7531", "#638b3d", "#527a33", "#5a8237"],
  winter: ["#eef2f6", "#e5ebf1", "#f3f6f9", "#dce4ec", "#e9eef3", "#f0f3f7"],
};

function Ground({ season }: { season: Season }) {
  const { geo, pick } = useMemo(() => {
    const g = new THREE.RingGeometry(3.2, 112, 180, 60);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, r = rng(5), pick = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) {
      p.setY(i, groundY(p.getX(i), p.getZ(i)));
      pick[i] = Math.floor(r() * 6);
    }
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(p.count * 3), 3));
    g.computeVertexNormals();
    return { geo: g, pick };
  }, []);
  useEffect(() => {
    const tones = GROUND[season].map((h) => new THREE.Color(h)), c = geo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pick.length; i++) c.setXYZ(i, tones[pick[i]].r, tones[pick[i]].g, tones[pick[i]].b);
    c.needsUpdate = true;
  }, [geo, pick, season]);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  return <mesh geometry={geo} material={mat} />;
}

// ---------------------------------------------------------------- the town on the shore
/** the town's windows after dark: each comes on in the evening and goes off when its household goes to bed (a few
 * after midnight), and some come on again before dawn for the early risers */
const WINDOW_VERT = /* glsl */ `
  uniform float uHours, uRise, uSet, uScale;
  attribute float aBed, aWake, aSize, aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vLit;
  void main(){
    float h = uHours, hh = h < 12. ? h + 24. : h, on = uSet + .1 + aSeed * .7;
    float lit = smoothstep(on, on + .08, hh) * (1. - smoothstep(aBed, aBed + .08, hh));
    vLit = max(lit, smoothstep(aWake, aWake + .08, h) * (1. - smoothstep(uRise + .3, uRise + .5, h)));
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const WINDOW_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vLit;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float a = smoothstep(.5, .18, max(abs(c.x) * 1.35, abs(c.y))) * vLit;
    if (a < .01) discard;
    gl_FragColor = vec4(vColor * 2.4 * a, 1.);
  }`;
/** the size of a metre at a metre away, in pixels: for points sized in the world */
const POINT_SCALE = { value: 800 };

function Town({ season }: { season: Season }) {
  const { meshes, roofs, roofMesh } = useMemo(() => {
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
    // a window or two in the wall that faces up the hill, toward the house
    const lw = rng(78), pos: number[] = [], bed: number[] = [], wake: number[] = [], size: number[] = [], seed: number[] = [], color: number[] = [];
    const warm = ["#ffc777", "#ffd796", "#ffb866", "#ffe2b0", "#cfe0ff"].map((h) => new THREE.Color(h));
    spots.forEach((s) => {
      if (lw() < 0.22) return;
      const dist = Math.hypot(s.x, s.z), dx = -s.x / dist, dz = -s.z / dist, y = groundY(s.x, s.z) - 0.25;
      const n = s.w > 3 ? 3 : lw() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const across = (n === 1 ? 0 : (k / (n - 1) - 0.5) * 0.6) * s.w + (lw() - 0.5) * 0.2;
        pos.push(s.x + dx * (Math.max(s.w, s.d) * 0.55 + 0.05) - dz * across, y + s.h * (0.35 + lw() * 0.25), s.z + dz * (Math.max(s.w, s.d) * 0.55 + 0.05) + dx * across);
        bed.push(20.6 + lw() * 5.2);
        wake.push(lw() < 0.3 ? 4.7 + lw() * 1.4 : 99);
        size.push(0.34 + lw() * 0.2);
        seed.push(lw());
        const c = warm[Math.floor(lw() * warm.length)];
        color.push(c.r, c.g, c.b);
      }
    });
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    wg.setAttribute("aBed", new THREE.Float32BufferAttribute(bed, 1));
    wg.setAttribute("aWake", new THREE.Float32BufferAttribute(wake, 1));
    wg.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
    wg.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    wg.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
    const windows = new THREE.Points(wg, new THREE.ShaderMaterial({
      uniforms: { uHours: U.hours, uRise: U.rise, uSet: U.set, uScale: POINT_SCALE },
      vertexShader: WINDOW_VERT, fragmentShader: WINDOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
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
    return { meshes: [box, roof, windows], roofs: spots.map((s) => s.roof), roofMesh: roof };
  }, []);
  // snow on the roofs in winter
  useEffect(() => {
    const snow = new THREE.Color("#eef2f6"), c = new THREE.Color();
    roofs.forEach((r, i) => roofMesh.setColorAt(i, season === "winter" ? c.copy(r).lerp(snow, 0.85) : r));
    if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
  }, [roofs, roofMesh, season]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// ---------------------------------------------------------------- trees: spruces, and maples turning
/** Lambert with vertex colours, a leafy speckle and a slow sway; the sway and the speckle use the instance's position */
function foliage(sway: number, leaf: number, side: THREE.Side = THREE.FrontSide) {
  const m = new THREE.MeshLambertMaterial({ color: "#ffffff", vertexColors: true, side });
  const uSway = { value: sway }, uLeafScale = { value: leaf };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uTime: TIME, uSway, uLeafScale, uSnow: U.snow });
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime, uSway, uLeafScale;\nvarying vec3 vLeaf;\nvarying float vUp;")
      .replace("#include <begin_vertex>", /* glsl */ `#include <begin_vertex>
        vec3 ip = instanceMatrix[3].xyz;
        float ph = ip.x * .37 + ip.z * .23;
        transformed += vec3(sin(uTime * 1.3 + ph), 0., cos(uTime * 1.05 + ph * 1.3)) * uSway * (position.y + 1.);
        vLeaf = ip * .21 + position * uLeafScale;
        vUp = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.)).xyz).y;`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", /* glsl */ `#include <common>
        uniform float uSnow;
        varying vec3 vLeaf;
        varying float vUp;
        float lh(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float ln(vec3 x){
          vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
          return mix(mix(mix(lh(i), lh(i + vec3(1., 0., 0.)), f.x), mix(lh(i + vec3(0., 1., 0.)), lh(i + vec3(1., 1., 0.)), f.x), f.y),
                     mix(mix(lh(i + vec3(0., 0., 1.)), lh(i + vec3(1., 0., 1.)), f.x), mix(lh(i + vec3(0., 1., 1.)), lh(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
        }`)
      .replace("#include <color_fragment>", /* glsl */ `#include <color_fragment>
        float leaf = ln(vLeaf * 4.) * .55 + ln(vLeaf * 10.) * .45;
        diffuseColor.rgb *= .62 + .7 * leaf;
        // in winter, snow on whatever faces up
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .96, 1.), uSnow * smoothstep(.2, .7, vUp) * (.65 + .35 * leaf));`);
  };
  m.customProgramCacheKey = () => "foliage";
  return m;
}

/** a colour attribute: a shade (or an rgb tint) per vertex */
function shadeVertices(g: THREE.BufferGeometry, shade: (i: number) => number | [number, number, number]) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = shade(i);
    c.set(typeof v === "number" ? [v, v, v] : v, i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

/** a spruce one unit tall: a short trunk, and tiers of branches narrowing to a spire. Each tier is an open cone whose
 * rim is a star: the branch tips reach out and hang down, the gaps between them pull in. Darker inside, lighter at the
 * tips, as new growth is. */
function spruceGeometry(seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [];
  parts.push(shadeVertices(new THREE.CylinderGeometry(0.01, 0.02, 0.2, 6).translate(0, 0.1, 0), () => 0.3));
  const tiers = 10;
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), rad = 0.13 * Math.pow(1 - t, 1.1) + 0.015, h = 0.16 - t * 0.07, y = 0.12 + t * 0.78;
    const seg = 2 * (7 + Math.floor(r() * 3)), cols = seg + 1;
    const reach = Array.from({ length: seg }, (_, c) => (c % 2 ? 0.5 + r() * 0.12 : 0.9 + r() * 0.3));
    const droop = Array.from({ length: seg }, (_, c) => (c % 2 ? 0.008 : 0.03 + r() * 0.03) * (1 - t * 0.5));
    const g = new THREE.ConeGeometry(rad, h, seg, 2, true);
    const p = g.attributes.position;
    // rows run from the apex (0) to the rim (2); the seam's last column repeats the first
    for (let row = 1; row < 3; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col, c = col % seg, sc = row === 2 ? reach[c] : 0.75 + 0.25 * reach[c];
        p.setXYZ(i, p.getX(i) * sc, p.getY(i) - droop[c] * (row === 2 ? 1 : 0.3), p.getZ(i) * sc);
      }
    }
    shadeVertices(g, (i) => {
      const row = Math.floor(i / cols), tip = ((i % cols) % seg) % 2 === 0;
      return row === 0 ? 0.55 : row === 1 ? 0.72 : tip ? 1.12 : 0.8;
    });
    g.rotateY(r() * Math.PI * 2).translate(0, y + h / 2, 0);
    g.computeVertexNormals();
    parts.push(g);
  }
  parts.push(shadeVertices(new THREE.ConeGeometry(0.008, 0.09, 6).translate(0, 1.0, 0), () => 0.7));
  return mergeGeometries(parts)!;
}

/** a maple's crown, about two units across and one and a half tall: clumps of small lumpy lobes, denser in the
 * middle and ragged at the edge, darker underneath and inside, each lobe a slightly different shade */
function crownGeometry(seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [], v = new THREE.Vector3();
  const unit = new THREE.IcosahedronGeometry(1, 1);
  unit.deleteAttribute("uv");
  unit.deleteAttribute("normal");
  const lobe = mergeVertices(unit);
  const clumps = 6 + Math.floor(r() * 3);
  for (let c = 0; c < clumps; c++) {
    const u = r() * Math.PI * 2, w = Math.acos(1 - r() * 1.5), cr = 0.4 + r() * 0.2;
    const cc = new THREE.Vector3(Math.sin(w) * Math.cos(u) * cr, Math.cos(w) * 0.36, Math.sin(w) * Math.sin(u) * cr);
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const g = lobe.clone(), sz = 0.2 + r() * 0.13, ph = r() * 10;
      const at = cc.clone().add(new THREE.Vector3((r() - 0.5) * 0.34, (r() - 0.5) * 0.24, (r() - 0.5) * 0.34));
      const tint = [1 + (r() - 0.5) * 0.16, 1 + (r() - 0.5) * 0.16, 1 + (r() - 0.5) * 0.1];
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const bump = 1 + 0.17 * Math.sin(v.x * 4.6 + ph) * Math.sin(v.y * 3.9 + ph * 1.3) * Math.sin(v.z * 4.3 + ph * 0.7) + 0.06 * Math.sin(v.x * 9.7 - v.z * 8.3 + ph);
        v.multiplyScalar(sz * bump).add(at);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      shadeVertices(g, (i) => {
        v.fromBufferAttribute(p, i);
        const k2 = 0.58 + 0.4 * THREE.MathUtils.smoothstep(v.y, -0.55, 0.6) + 0.12 * THREE.MathUtils.smoothstep(Math.hypot(v.x, v.z), 0.35, 0.85);
        return [k2 * tint[0], k2 * tint[1], k2 * tint[2]];
      });
      g.computeVertexNormals();
      parts.push(g);
    }
  }
  return mergeGeometries(parts)!;
}

/** a maple's trunk and its first branches, one unit tall, reaching up into the crown */
function mapleWoodGeometry(seed: number) {
  const r = rng(seed), parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.016, 0.03, 0.7, 7).translate(0, 0.35, 0)];
  for (let k = 0; k < 3; k++) {
    const len = 0.26 + r() * 0.08;
    parts.push(new THREE.CylinderGeometry(0.006, 0.012, len, 5).translate(0, len / 2, 0).rotateZ(0.55 + r() * 0.3).rotateY((k / 3) * Math.PI * 2 + r() * 0.8).translate(0, 0.42 + r() * 0.12, 0));
  }
  return mergeGeometries(parts)!;
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
/** the maples through the year: fresh green and blossom in spring, deep green in summer, turning in autumn, laden with
 * snow in winter */
const MAPLE: Record<Season, THREE.Color[]> = Object.fromEntries(Object.entries({
  autumn: ["#d9822b", "#e6a640", "#c0602a", "#e8c35a", "#cf7a2e", "#b9552c", "#9aa54a", "#d99a3a"],
  spring: ["#9cc75a", "#8dbb4f", "#f2b6c6", "#a9cf6a", "#7fae4a", "#f6d3dc", "#b5d77a", "#93c25c"],
  summer: ["#4f7f34", "#5a8a3a", "#46752f", "#6a9644", "#3f6b2c", "#58883c", "#4b7a35", "#62903f"],
  winter: ["#e9eff5", "#dfe7ef", "#d6dfe9", "#eef3f8", "#cbd5e1", "#e3eaf1", "#d1dae5", "#e6edf4"],
}).map(([k, v]) => [k, v.map((h) => new THREE.Color(h))])) as Record<Season, THREE.Color[]>;
const FIR = ["#2e4a3b", "#34523f", "#294236", "#3a5a44"].map((h) => new THREE.Color(h));
const EYE_Y = 1.42;

/** in front of the window, trees stay below the line of the far shore so the view stays open */
function maxHeight(a: number, r: number, ground: number) {
  if (Math.abs(a) > 0.6 || r > 50) return Infinity;
  return EYE_Y - r * Math.tan(0.14) - ground;
}

function Trees({ season }: { season: Season }) {
  const { meshes, crowns } = useMemo(() => {
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

    const o = new THREE.Object3D(), out: THREE.Object3D[] = [];
    const firs = trees.filter((t) => t.kind === "fir"), maples = trees.filter((t) => t.kind === "maple");

    // spruces, in three shapes
    const spruceMat = foliage(0.004, 3, THREE.DoubleSide);
    [11, 12, 13].map(spruceGeometry).forEach((geo, v, all) => {
      const mine = firs.filter((_, i) => i % all.length === v);
      const mesh = new THREE.InstancedMesh(geo, spruceMat, mine.length);
      mine.forEach((t, i) => {
        const x = Math.sin(t.a) * t.r, z = -Math.cos(t.a) * t.r, w = 0.9 + r() * 0.25;
        o.position.set(x, groundY(x, z) - 0.3, z);
        o.rotation.set((r() - 0.5) * 0.04, r() * 6.28, (r() - 0.5) * 0.04);
        o.scale.set(t.h * w, t.h, t.h * w);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, FIR[Math.floor(r() * FIR.length)].clone().offsetHSL(0, 0, (r() - 0.5) * 0.04));
      });
      out.push(mesh);
    });

    // maples: four crowns to choose from, and their trunks; each crown keeps its own pick of colour for the season
    const crowns: { mesh: THREE.InstancedMesh; pick: number[]; dh: number[]; dl: number[] }[] = [];
    const crownMat = foliage(0.006, 2.4);
    const trunks = new THREE.InstancedMesh(mapleWoodGeometry(31), new THREE.MeshLambertMaterial({ color: "#4a3a2e" }), maples.length);
    [21, 22, 23, 24].map(crownGeometry).forEach((geo, v, all) => {
      const mine = maples.map((t, i) => ({ t, i })).filter(({ i }) => i % all.length === v);
      const mesh = new THREE.InstancedMesh(geo, crownMat, mine.length), crown = { mesh, pick: [] as number[], dh: [] as number[], dl: [] as number[] };
      crowns.push(crown);
      mine.forEach(({ t, i }, j) => {
        const x = Math.sin(t.a) * t.r, z = -Math.cos(t.a) * t.r, y0 = groundY(x, z) - 0.3;
        const cs = t.h * 0.36 * (t.crown ?? 1), yaw = r() * 6.28;
        o.position.set(x, y0, z);
        o.rotation.set(0, yaw, 0);
        o.scale.setScalar(t.h);
        o.updateMatrix();
        trunks.setMatrixAt(i, o.matrix);
        o.position.set(x, y0 + t.h - cs * 0.9, z);
        o.scale.set(cs * (0.9 + r() * 0.2), cs * (0.85 + r() * 0.2), cs * (0.9 + r() * 0.2));
        o.updateMatrix();
        mesh.setMatrixAt(j, o.matrix);
        crown.pick.push(r());
        crown.dh.push((r() - 0.5) * 0.02);
        crown.dl.push((r() - 0.5) * 0.06);
        mesh.setColorAt(j, MAPLE.autumn[0]);
      });
      out.push(mesh);
    });
    out.push(trunks);
    return { meshes: out, crowns };
  }, []);
  useEffect(() => {
    const pal = MAPLE[season], c = new THREE.Color();
    crowns.forEach(({ mesh, pick, dh, dl }) => {
      pick.forEach((p, j) => mesh.setColorAt(j, c.copy(pal[Math.floor(p * pal.length)]).offsetHSL(dh[j], 0, dl[j])));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [crowns, season]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// ---------------------------------------------------------------- the air outside: snow, falling leaves, blossom, fireflies
/** reach: how far out from the house they are; dim: how much darker they look at night */
type Air = { n: number; colors: string[]; size: number; fall: number; sway: number; tumble: number; glow: number; top: number; span: number; reach: number; dim: number };
const AIR: Record<Season, Air> = {
  winter: { n: 700, colors: ["#ffffff", "#f2f6ff", "#e8efff"], size: 0.09, fall: 0.55, sway: 0.35, tumble: 0, glow: 0, top: 8, span: 15, reach: 20, dim: 0.55 },
  autumn: { n: 46, colors: ["#d9822b", "#e6a640", "#c0602a", "#b9552c", "#e8c35a"], size: 0.24, fall: 0.7, sway: 1.1, tumble: 1, glow: 0, top: 6, span: 11, reach: 9, dim: 0.85 },
  spring: { n: 90, colors: ["#f7c6d4", "#f2b3c6", "#fbe3ea", "#ffffff"], size: 0.12, fall: 0.42, sway: 0.9, tumble: 1, glow: 0, top: 6, span: 11, reach: 9, dim: 0.85 },
  // summer nights: fireflies over the hillside below the house
  summer: { n: 70, colors: ["#d8ff7a", "#f1ff9a", "#c6f26b"], size: 0.09, fall: 0, sway: 0.9, tumble: 0, glow: 1, top: 0.5, span: 5, reach: 20, dim: 0 },
};
const AIR_VERT = /* glsl */ `
  uniform float uTime, uFall, uSway, uSize, uScale, uTop, uSpan, uGlow, uLight, uNight;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vSpin, vA;
  void main(){
    vec3 p = position;
    float t = uTime + aSeed * 50.;
    p.y = uTop - mod(uTop - p.y + uTime * uFall * (.7 + aSeed * .6), uSpan);
    p.x += sin(t * .63 + aSeed * 11.) * uSway;
    p.z += cos(t * .51 + aSeed * 7.) * uSway * .8;
    p.y += sin(t * .41 + aSeed * 5.) * .5 * uGlow;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_PointSize = uSize * (.7 + aSeed * .6) * uScale / -mv.z;
    vSpin = t * (1.2 + aSeed * 1.8);
    // falling things fade in and out at the top and the bottom of the fall; fireflies blink, and only at night
    float edge = smoothstep(0., 1.5, uTop - p.y) * smoothstep(0., 1.5, p.y - (uTop - uSpan));
    vA = mix(edge, smoothstep(.55, 1., sin(t * 1.7 + aSeed * 31.)) * uNight, uGlow);
    vColor = aColor * mix(uLight, 2.6, uGlow);
    gl_Position = projectionMatrix * mv;
  }`;
const AIR_FRAG = /* glsl */ `
  uniform float uTumble, uGlow;
  varying vec3 vColor;
  varying float vSpin, vA;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float s = sin(vSpin), co = cos(vSpin);
    c = mat2(co, -s, s, co) * c;
    // a leaf or a petal tumbles as it falls: edge-on one moment, flat the next
    c.y *= mix(1., 2.2 + 1.4 * abs(sin(vSpin * .7)), uTumble);
    float a = (1. - smoothstep(mix(.5, .7, uTumble), 1., length(c) * 2.)) * vA;
    if (a < .02) discard;
    gl_FragColor = uGlow > .5 ? vec4(vColor * a, 1.) : vec4(vColor, a);
  }`;

function Weather({ season }: { season: Season }) {
  const air = AIR[season];
  const points = useMemo(() => {
    const r = rng(91), pos: number[] = [], seed: number[] = [], color: number[] = [];
    const cols = air.colors.map((h) => new THREE.Color(h));
    while (seed.length < air.n) {
      const x = (r() - 0.5) * (air.reach * 1.5), z = 2.5 - r() * (air.reach + 2.5);
      // never inside the room, nor up against its glass
      if (Math.abs(x) < 4.3 && z > -3.6) continue;
      pos.push(x, air.top - r() * air.span, z);
      seed.push(r());
      const c = cols[Math.floor(r() * cols.length)];
      color.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: TIME, uScale: POINT_SCALE, uNight: U.night, uLight: { value: 1 },
        uFall: { value: air.fall }, uSway: { value: air.sway }, uSize: { value: air.size }, uTop: { value: air.top }, uSpan: { value: air.span },
        uTumble: { value: air.tumble }, uGlow: { value: air.glow },
      },
      vertexShader: AIR_VERT, fragmentShader: AIR_FRAG,
      transparent: true, depthWrite: false, blending: air.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    return p;
  }, [air]);
  useEffect(() => () => { points.geometry.dispose(); (points.material as THREE.Material).dispose(); }, [points]);
  // what falls is lit by the hour: bright by day, dim under the moon
  useFrame(() => { (points.material as THREE.ShaderMaterial).uniforms.uLight.value = 1 - air.dim * SKY.night; });
  return <primitive object={points} />;
}

export default function Outside() {
  const season = useSeason();
  useEffect(() => { U.snow.value = season === "winter" ? 1 : 0; }, [season]);
  useFrame(({ clock, camera, gl }) => {
    TIME.value = clock.elapsedTime;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    POINT_SCALE.value = gl.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  });
  return (
    <group>
      <Sky />
      {RIDGES.map((d) => <Ridge key={d.seed} d={d} season={season} />)}
      <Lake season={season} />
      <Ground season={season} />
      <Town season={season} />
      <Trees season={season} />
      <Weather season={season} />
    </group>
  );
}
