"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js only loads when the boot script chose the room (see app/layout.tsx)
const Experience = dynamic(() => import("./Experience"), { ssr: false });

export default function RoomMount() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(document.documentElement.classList.contains("room"));
  }, []);
  return on ? <Experience /> : null;
}
