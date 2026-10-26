"use client";

import { MainMap } from "./components/MainMap";
import { TopBar } from "./components/TopBar";
import { RailModeSwitch } from "./components/RailModeSwitch";
import { ViaStationControl } from "./components/ViaStationControl";
import { MapStationProvider } from "@/context/StationContext";

export default function Home() {
  return (
    <MapStationProvider>
      {/* ヘッダーと、その下の左右のコントロール (地図の操作を妨げないよう、余白はクリックを透過する) */}
      <div className="fixed inset-x-0 top-0 md:top-5 z-10 flex flex-col gap-2 pointer-events-none">
        <TopBar />
        <div className="flex items-start gap-2 px-2 md:px-5">
          <ViaStationControl />
          <RailModeSwitch />
        </div>
      </div>
      <main>
        <MainMap />
      </main>
    </MapStationProvider>
  );
}
