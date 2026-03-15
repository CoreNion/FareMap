"use client";

import { MainMap } from "./components/MainMap";
import { TopBar } from "./components/TopBar";
import { MapStationProvider } from "@/context/StationContext";

export default function Home() {
  return (
    <MapStationProvider>
      <main className="">
        <TopBar />
        <MainMap />
      </main>
    </MapStationProvider>
  );
}
