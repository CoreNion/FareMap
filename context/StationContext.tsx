"use client";

import { createContext, useContext, useState, ReactNode } from "react";

import type { MapStation, RailMode } from "@/types/map";
import type { FareType } from "@/types/fare";
import type { RailwayId } from "@/types/railway";

/** 私鉄線モードで、発駅に選択した場合にJR線の駅を初期表示する事業者 (JR線と直通・同じ改札の駅がある事業者) */
const SHOW_JR_BY_DEFAULT_RAILWAYS: RailwayId[] = ["metro", "sotetsu"];

interface StationContextType {
  selectedStation: MapStation | undefined;
  setSelectedStation: (station: MapStation | undefined) => void;
  /** 表示する運賃の種別 (きっぷ / IC) */
  fareType: FareType;
  setFareType: (fareType: FareType) => void;
  /** 地図に表示する路線の区分 (JR線 / 私鉄線) */
  railMode: RailMode;
  setRailMode: (railMode: RailMode) => void;
  /** 私鉄線モードで、JR線のみの駅を表示するか */
  showJrStations: boolean;
  setShowJrStations: (show: boolean) => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const MapStationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedStation, setSelectedStationState] = useState<MapStation | undefined>();
  const [fareType, setFareType] = useState<FareType>('ticket');
  const [railMode, setRailModeState] = useState<RailMode>('jr');
  const [showJrStations, setShowJrStations] = useState(false);

  // 発駅の選択時に、発駅の事業者に応じてJR線の駅の表示を初期化する
  const setSelectedStation = (station: MapStation | undefined) => {
    setSelectedStationState(station);
    setShowJrStations(station?.railways?.some((r) => SHOW_JR_BY_DEFAULT_RAILWAYS.includes(r)) ?? false);
  };

  // 路線の区分ごとに発駅となる駅が異なるため、切り替え時に選択中の駅を解除する
  const setRailMode = (mode: RailMode) => {
    if (mode === railMode) return;
    setRailModeState(mode);
    setSelectedStation(undefined);
  };

  return (
    <StationContext.Provider value={{
      selectedStation, setSelectedStation, fareType, setFareType, railMode, setRailMode, showJrStations, setShowJrStations,
    }}>
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
