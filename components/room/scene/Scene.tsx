"use client";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useRef } from "react";
import CameraRig from "../camera/CameraRig";
import { useRoom } from "../store";
import Alley from "./Alley";
import Bookshelf from "./Bookshelf";
import CorkBoard from "./CorkBoard";
import Desk, { Lamp } from "./Desk";
import Glass from "./Glass";
import Laptop from "./Laptop";
import Phone from "./Phone";
import { Calendar, Coffee, Fan, FloorLamp, Plant } from "./Props";
import Room from "./Room";

/** the room is "ready" once it has drawn a few frames (the canvas fades in, the gate offers ENTER) */
function Ready() {
  const n = useRef(0);
  useFrame(() => {
    if (n.current++ === 4) useRoom.getState().setReady();
  });
  return null;
}

export default function Scene() {
  return (
    <>
      <color attach="background" args={["#05060a"]} />
      <fog attach="fog" args={["#0b0a16", 30, 140]} />

      {/* night: the city's glow as a cool fill, the neon coming in through the window, lamps where things are read */}
      <hemisphereLight args={["#6d7ba8", "#3a2c22", 1.05]} />
      <pointLight position={[0.2, 1.85, -1.3]} color="#ff4f86" intensity={1.3} distance={5} decay={2} />
      <pointLight position={[-1.0, 1.2, -1.1]} color="#3ee6d2" intensity={0.8} distance={4} decay={2} />

      <Room />
      <Desk />
      <Lamp />
      <Laptop />
      <Phone />
      <Coffee />
      <Plant />
      <Fan />
      <FloorLamp />
      <Calendar />
      <CorkBoard />
      <Bookshelf />
      <Glass />
      <Alley />

      <CameraRig />
      <Ready />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.25} intensity={0.75} radius={0.7} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.32} darkness={0.62} />
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.18} />
      </EffectComposer>
    </>
  );
}
