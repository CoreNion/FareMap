"use client";

import { createContext, useContext, useState, ReactNode } from "react";

import type { MapStation, RailMode } from "@/types/map";
import type { FareType } from "@/types/fare";
import type { ViaStation } from "@/types/via";

interface StationContextType {
  selectedStation: MapStation | undefined;
  setSelectedStation: (station: MapStation | undefined) => void;
  /** 表示する運賃の種別 (きっぷ / IC) */
  fareType: FareType;
  setFareType: (fareType: FareType) => void;
  /** 地図に表示する路線の区分 (JR線 / 私鉄線) */
  railMode: RailMode;
  setRailMode: (railMode: RailMode) => void;
  /** 営業キロが物理的な距離に比べて大きすぎる駅も含めて、全駅を表示するか */
  showAllStations: boolean;
  setShowAllStations: (show: boolean) => void;
  /** 経由駅の指定パネルを開いているか */
  viaPanelOpen: boolean;
  setViaPanelOpen: (open: boolean) => void;
  /** 改札外乗り換えの経由駅 (未指定の場合は`undefined`) */
  viaStation: ViaStation | undefined;
  /** 経由駅(降車駅)を指定する (乗車駅は同じ駅にリセットされる) */
  setViaAlightStation: (station: MapStation) => void;
  /** 経由駅で再び乗車する駅を指定する (降車駅の指定後のみ) */
  setViaBoardStation: (station: MapStation) => void;
  /** 経由駅の指定を解除する */
  clearViaStation: () => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const MapStationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedStation, setSelectedStationState] = useState<MapStation | undefined>();
  const [fareType, setFareType] = useState<FareType>('ticket');
  const [railMode, setRailModeState] = useState<RailMode>('jr');
  const [showAllStations, setShowAllStations] = useState(false);
  const [viaStation, setViaStation] = useState<ViaStation | undefined>();
  const [viaPanelOpen, setViaPanelOpen] = useState(false);

  // 経由駅は発駅ごとに指定するため、発駅の選択時に解除する
  const setSelectedStation = (station: MapStation | undefined) => {
    setSelectedStationState(station);
    setViaStation(undefined);
    setViaPanelOpen(false);
  };

  // 経由駅の指定時は、乗換駅の候補を確認できるようにパネルを開く
  const setViaAlightStation = (station: MapStation) => {
    setViaStation({ alight: station, board: station });
    setViaPanelOpen(true);
  };

  const setViaBoardStation = (station: MapStation) => {
    setViaStation((prev) => prev && { ...prev, board: station });
  };

  const clearViaStation = () => setViaStation(undefined);

  // 路線の区分ごとに発駅となる駅が異なるため、切り替え時に選択中の駅を解除する
  const setRailMode = (mode: RailMode) => {
    if (mode === railMode) return;
    setRailModeState(mode);
    setSelectedStation(undefined);
  };

  return (
    <StationContext.Provider value={{
      selectedStation, setSelectedStation, fareType, setFareType, railMode, setRailMode,
      showAllStations, setShowAllStations, viaPanelOpen, setViaPanelOpen,
      viaStation, setViaAlightStation, setViaBoardStation, clearViaStation,
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
