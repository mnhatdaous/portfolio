"use client";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, HueSaturation, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import CameraRig from "../camera/CameraRig";
import { SKY, updateSky } from "../lib/sky";
import { useRoom } from "../store";
import Bookshelf from "./Bookshelf";
import Cat from "./Cat";
import Computer from "./Computer";
import CorkBoard from "./CorkBoard";
import Desk from "./Desk";
import Outside from "./Outside";
import Phone from "./Phone";
import { FiddleLeafFig, Monstera, OliveTree, RubberPlant } from "./Plants";
import { Calendar } from "./Calendar";
import { DeskClock, DustMotes, Mug, PendantLamp, ReadingCorner } from "./Props";
import { DeskLamp } from "./DeskLamp";
import { Headphones } from "./Headphones";
import { Guitar, Paintings } from "./Art";
import Room, { GLASS_Z, ROOF, ROOF_Z, ROOM } from "./Room";

/** the room is "ready" once it has drawn a few frames (the canvas fades in, the gate offers ENTER) */
function Ready() {
  const n = useRef(0);
  useFrame(() => {
    if (n.current++ === 4) useRoom.getState().setReady();
  });
  return null;
}

// the windows as soft lights, each shining into the room from its glass: the big window, the glass roof sloping up
// over it (shining down and in), and the side windows
const SLOPE = new THREE.Vector3(0, (ROOF.eave + ROOM.h) / 2 - 0.06, (GLASS_Z + ROOF_Z) / 2 + 0.05);
const WINDOW_LIGHTS: { pos: [number, number, number]; look: THREE.Vector3; w: number; h: number; k: number }[] = [
  { pos: [0, (0.8 + ROOF.eave) / 2, -2.26], look: new THREE.Vector3(0, 1.2, 0), w: 6.2, h: ROOF.eave - 0.8, k: 1.2 },
  { pos: SLOPE.toArray(), look: SLOPE.clone().add(new THREE.Vector3(0, -Math.cos(ROOF.pitch), Math.sin(ROOF.pitch))), w: 6.2, h: 1.7, k: 1.1 },
  { pos: [-3.16, 1.95, -0.97], look: new THREE.Vector3(0, 1.4, -0.97), w: 2.6, h: 2.3, k: 0.9 },
  { pos: [3.16, 1.95, -0.97], look: new THREE.Vector3(0, 1.4, -0.97), w: 2.6, h: 2.3, k: 0.9 },
];

/** the light of the hour (lib/sky.ts): the sun or the moon through the glass, the sky's light from all of it, and at
 * night the lamps. They come on at sunset and go off in the morning; in between, they're the visitor's to switch. */
function Daylight() {
  useMemo(() => RectAreaLightUniformsLib.init(), []);
  const rects = useRef<(THREE.RectAreaLight | null)[]>([]);
  useLayoutEffect(() => rects.current.forEach((l, i) => l?.lookAt(WINDOW_LIGHTS[i].look)), []);
  const sun = useRef<THREE.DirectionalLight>(null), sky = useRef<THREE.HemisphereLight>(null), bounce = useRef<THREE.PointLight>(null);
  const dark = useRef<boolean | null>(null);
  useFrame(({ scene }) => {
    updateSky();
    if (sun.current) {
      sun.current.position.copy(SKY.light).multiplyScalar(30);
      sun.current.color.copy(SKY.lightColor);
      sun.current.intensity = SKY.lightK;
    }
    if (sky.current) {
      sky.current.color.copy(SKY.hemiSky);
      sky.current.groundColor.copy(SKY.hemiGround);
      sky.current.intensity = SKY.hemiK;
    }
    rects.current.forEach((l, i) => {
      if (!l) return;
      l.color.copy(SKY.win);
      l.intensity = WINDOW_LIGHTS[i].k * SKY.winK;
    });
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(SKY.haze);
    if (scene.background instanceof THREE.Color) scene.background.copy(SKY.horizon);
    // the lamps: on as the sun goes down, off once it's well up
    const isDark = SKY.sunSin < (dark.current ? 0.06 : 0);
    if (isDark !== dark.current) {
      dark.current = isDark;
      useRoom.setState({ lamp: isDark, deskLamp: isDark, floorLamp: isDark });
    }
    // at night the lamps' light carries round the room, off the walls and the ceiling
    const st = useRoom.getState();
    if (bounce.current) bounce.current.intensity = SKY.night * ((st.lamp ? 1.5 : 0) + (st.deskLamp ? 0.35 : 0) + (st.floorLamp ? 0.8 : 0));
  });
  return (
    <>
      <hemisphereLight ref={sky} args={["#dbe8f5", "#a37b52", 0.75]} />
      <directionalLight
        ref={sun}
        color="#ffe3bf"
        intensity={5.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6.5}
        shadow-camera-right={6.5}
        shadow-camera-top={6.5}
        shadow-camera-bottom={-6.5}
        shadow-camera-near={5}
        shadow-camera-far={60}
        shadow-bias={-0.0003}
        shadow-normalBias={0.006}
        shadow-radius={2}
      />
      {WINDOW_LIGHTS.map((w, i) => (
        <rectAreaLight key={i} ref={(l) => { rects.current[i] = l; }} position={w.pos} width={w.w} height={w.h} intensity={w.k} color="#eaf2fb" />
      ))}
      <pointLight ref={bounce} position={[0.2, 2.75, 0.4]} color="#ffcf9a" intensity={0} distance={11} decay={1.3} />
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
      <DeskLamp />
      <Headphones />
      <Monstera />
      <RubberPlant />
      <OliveTree />
      <FiddleLeafFig />
      <CorkBoard />
      <Calendar />
      <Paintings />
      <Guitar />
      <Bookshelf />
      <ReadingCorner />
      <DustMotes />
      <Outside />

      <CameraRig />
      <Ready />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.08} intensity={0.45} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <HueSaturation saturation={0.04} />
        <SMAA />
        <Vignette offset={0.38} darkness={0.36} />
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.07} />
      </EffectComposer>
    </>
  );
}
