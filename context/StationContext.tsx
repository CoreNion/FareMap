"use client";

import { createContext, useContext, useState, ReactNode } from "react";

import type { MapStation } from "@/types/map";
import type { FareType } from "@/types/fare";

interface StationContextType {
  selectedStation: MapStation | undefined;
  setSelectedStation: (station: MapStation | undefined) => void;
  /** 表示する運賃の種別 (きっぷ / IC) */
  fareType: FareType;
  setFareType: (fareType: FareType) => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const MapStationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedStation, setSelectedStation] = useState<MapStation | undefined>();
  const [fareType, setFareType] = useState<FareType>('ticket');

  return (
    <StationContext.Provider value={{ selectedStation, setSelectedStation, fareType, setFareType }}>
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
