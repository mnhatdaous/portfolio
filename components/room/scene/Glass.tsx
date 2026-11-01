"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { clickable } from "../lib/interact";
import { useRoom } from "../store";
import { WIN } from "./Room";

// Rain on the window: still beads, and drops that slide down leaving a thin wet trail. No background is refracted;
// each drop shows the colours around it instead (the neon to either side, the street lamp below), which reads as a drop.
const frag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uSize;

  float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

  // a dome of water in some cells of a grid
  float beads(vec2 p, float scale, float seed, float t){
    vec2 g = p * scale, id = floor(g), f = fract(g) - .5;
    float a = h21(id + seed), b = h21(id + seed + 17.3), c = h21(id + seed + 41.7);
    if (c > .36) return 0.;
    vec2 o = (vec2(a, b) - .5) * .6;
    float life = fract(t * .02 + a);                 // they gather and evaporate, slowly
    float r = (.08 + .22 * c) * smoothstep(0., .15, life) * smoothstep(1., .75, life);
    float d = length(f - o) / max(r, 1e-3);
    return max(0., 1. - d * d);
  }

  // drops sliding down in columns, each with a trail of tiny beads above it
  float slide(vec2 uv, float t){
    float cols = 9.;
    float x = uv.x * cols, id = floor(x), fx = fract(x) - .5;
    float r1 = h11(id * 7.13 + 1.), r2 = h11(id * 3.71 + 5.), r3 = h11(id * 1.37 + 9.);
    // slide, stop, slide: drops stick to the glass for a moment
    float ph = t * (.035 + .05 * r1) + r2;
    float y = 1.15 - (fract(ph) + .04 * sin(fract(ph) * 30.)) * 1.3;
    float cx = (r3 - .5) * .5 + sin(uv.y * 23. + id) * .05;
    float dx = fx - cx;
    float dy = (uv.y - y) * cols * (uSize.y / uSize.x);
    float head = max(0., 1. - (dx * dx + dy * dy * .8) / .012);
    float above = uv.y - y, len = .1 + .12 * r1;
    float trail = 0.;
    if (above > 0. && above < len) {
      float k = 1. - above / len, w = .03 * k;
      trail = smoothstep(w, w * .3, abs(dx)) * k * .22;
      float b = fract(above * 40. + r2 * 9.);
      trail = max(trail, smoothstep(.25, 0., abs(b - .5)) * smoothstep(w * 1.2, 0., abs(dx)) * k * .5);
    }
    return max(head, trail);
  }

  float height(vec2 uv){
    vec2 p = uv * uSize;                               // metres, so beads are round
    return max(max(beads(p, 42., 0., uTime), beads(p, 90., 11., uTime + 3.) * .7), slide(uv, uTime));
  }

  void main(){
    float h = height(vUv);
    vec2 e = vec2(.0015, 0.);
    vec2 n = vec2(height(vUv + e.xy) - h, height(vUv + e.yx) - h) * 18.;
    float mask = smoothstep(.04, .3, h);
    vec3 env = mix(vec3(1., .3, .55), vec3(.25, .95, .9), smoothstep(-.6, .6, n.x));
    env = mix(env, vec3(1., .65, .3), smoothstep(.1, .8, -n.y) * .7);
    vec3 N = normalize(vec3(-n, 1.));
    float spec = pow(max(0., dot(N, normalize(vec3(-.35, .55, .75)))), 60.);
    float rim = smoothstep(.0, .12, h) * (1. - smoothstep(.12, .5, h));
    vec3 col = env * .3 * mask + spec * 1.2;
    col = mix(col, vec3(.01, .015, .03), rim * .5);
    float alpha = clamp(mask * .3 + spec * .55 + rim * .2 + .02, 0., .9);
    gl_FragColor = vec4(col, alpha);
  }`;

export default function Glass() {
  const w = WIN.x1 - WIN.x0 - 0.1, h = WIN.y1 - WIN.y0 - 0.1;
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
  }), [w, h]);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
  return (
    <mesh
      position={[(WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -0.67]}
      material={mat}
      {...clickable("LOOK OUTSIDE", () => useRoom.getState().go("window"))}
    >
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}
