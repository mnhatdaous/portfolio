"use client";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, HueSaturation, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import CameraRig from "../camera/CameraRig";
import { useRoom } from "../store";
import Bookshelf, { Library } from "./Bookshelf";
import Cat from "./Cat";
import Computer from "./Computer";
import CorkBoard from "./CorkBoard";
import Desk from "./Desk";
import Outside, { SUN } from "./Outside";
import Phone from "./Phone";
import { Calendar, DeskClock, DustMotes, Monstera, Mug, PendantLamp, ReadingCorner, RubberPlant } from "./Props";
import Room from "./Room";

/** the room is "ready" once it has drawn a few frames (the canvas fades in, the gate offers ENTER) */
function Ready() {
  const n = useRef(0);
  useFrame(() => {
    if (n.current++ === 4) useRoom.getState().setReady();
  });
  return null;
}

// the windows as soft lights, each shining into the room from its glass
const WINDOW_LIGHTS = [
  { pos: [0, 1.65, -2.26] as const, look: new THREE.Vector3(0, 1.2, 0), w: 4.4, h: 1.6, k: 1.3 },
  { pos: [-2.26, 1.5, -0.97] as const, look: new THREE.Vector3(0, 1.2, -0.97), w: 2.5, h: 1.9, k: 0.9 },
  { pos: [2.26, 1.5, -0.97] as const, look: new THREE.Vector3(0, 1.2, -0.97), w: 2.5, h: 1.9, k: 0.9 },
];

/** an autumn afternoon: the sun low through the front-left windows, the sky's light from all the glass */
function Daylight() {
  useMemo(() => RectAreaLightUniformsLib.init(), []);
  const rects = useRef<(THREE.RectAreaLight | null)[]>([]);
  useLayoutEffect(() => rects.current.forEach((l, i) => l?.lookAt(WINDOW_LIGHTS[i].look)), []);
  const sunPos = useMemo(() => SUN.clone().multiplyScalar(30).toArray(), []);
  return (
    <>
      <hemisphereLight args={["#dbe8f5", "#a37b52", 0.75]} />
      <directionalLight
        position={sunPos}
        color="#ffe3bf"
        intensity={5.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={5}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {WINDOW_LIGHTS.map((w, i) => (
        <rectAreaLight key={i} ref={(l) => { rects.current[i] = l; }} position={w.pos} width={w.w} height={w.h} intensity={w.k} color="#eaf2fb" />
      ))}
    </>
  );
}

export default function Scene() {
  return (
    <>
      <color attach="background" args={["#dce7ef"]} />
      <fog attach="fog" args={["#dbe5ec", 60, 380]} />
      <Daylight />

      <Room />
      <Desk />
      <Computer />
      <Phone />
      <Cat />
      <Mug />
      <DeskClock />
      <PendantLamp />
      <Monstera />
      <RubberPlant />
      <CorkBoard />
      <Calendar />
      <Bookshelf />
      <Library />
      <ReadingCorner />
      <DustMotes />
      <Outside />

      <CameraRig />
      <Ready />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.08} intensity={0.45} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <HueSaturation saturation={0.04} />
        <Vignette offset={0.38} darkness={0.36} />
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.07} />
      </EffectComposer>
    </>
  );
}
