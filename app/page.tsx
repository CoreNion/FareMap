"use client";

import { MainMap } from "./components/MainMap";
import { TopBar } from "./components/TopBar";
import { RailModeSwitch } from "./components/RailModeSwitch";
import { MapStationProvider } from "@/context/StationContext";

export default function Home() {
  return (
    <MapStationProvider>
      <TopBar />
      <RailModeSwitch />
      <main>
        <MainMap />
      </main>
    </MapStationProvider>
  );
}
