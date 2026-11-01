import StaticSite from "@/components/StaticSite";
import RoomMount from "@/components/room/RoomMount";

// The plain page is always in the HTML (search engines, screen readers, old GPUs).
// When the boot script picked the room, CSS hides it and RoomMount loads the 3D scene over it.
export default function Page() {
  return (
    <>
      <StaticSite />
      <RoomMount />
    </>
  );
}
