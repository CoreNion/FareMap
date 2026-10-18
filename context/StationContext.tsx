"use client";

import { createContext, useContext, useState, ReactNode } from "react";

import type { MapStation, RailMode } from "@/types/map";
import type { FareType } from "@/types/fare";

interface StationContextType {
  selectedStation: MapStation | undefined;
  setSelectedStation: (station: MapStation | undefined) => void;
  /** 表示する運賃の種別 (きっぷ / IC) */
  fareType: FareType;
  setFareType: (fareType: FareType) => void;
  /** 地図に表示する路線の区分 (JR線 / 私鉄線) */
  railMode: RailMode;
  setRailMode: (railMode: RailMode) => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const MapStationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedStation, setSelectedStation] = useState<MapStation | undefined>();
  const [fareType, setFareType] = useState<FareType>('ticket');
  const [railMode, setRailModeState] = useState<RailMode>('jr');

  // 路線の区分ごとに発駅となる駅が異なるため、切り替え時に選択中の駅を解除する
  const setRailMode = (mode: RailMode) => {
    if (mode === railMode) return;
    setRailModeState(mode);
    setSelectedStation(undefined);
  };

  return (
    <StationContext.Provider value={{ selectedStation, setSelectedStation, fareType, setFareType, railMode, setRailMode }}>
      {children}
    </StationContext.Provider>
  );
};

export const useMapStation = () => {
  const context = useContext(StationContext);
  if (context === undefined) {
    throw new Error("StationProvider内で呼び出されていません");
  }
  return context;
};
