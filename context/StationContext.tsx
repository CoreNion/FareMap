"use client";

import { createContext, useContext, useState, ReactNode } from "react";

import type {MapStation} from "@/types/map";
import type { SUPPORTED_RAILWAY } from "@/types/railway";

interface StationContextType {
  /** 表示中の鉄道事業者 */
  railway: SUPPORTED_RAILWAY;
  /** 表示する鉄道事業者を切り替える (選択中の駅はリセットされる) */
  changeRailway: (railway: SUPPORTED_RAILWAY) => void;
  selectedStation: MapStation | undefined;
  setSelectedStation: (station: MapStation | undefined) => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const MapStationProvider = ({ children }: { children: ReactNode }) => {
  const [railway, setRailway] = useState<SUPPORTED_RAILWAY>("jre");
  const [selectedStation, setSelectedStation] = useState<MapStation | undefined>();

  const changeRailway = (next: SUPPORTED_RAILWAY) => {
    if (next === railway) return;
    // 事業者が変わると駅IDの対応が無くなるため、選択中の駅も同時にリセットする
    setRailway(next);
    setSelectedStation(undefined);
  };

  return (
    <StationContext.Provider value={{ railway, changeRailway, selectedStation, setSelectedStation }}>
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
