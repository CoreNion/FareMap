"use client";

import { createContext, useContext, useState, ReactNode } from "react";

import type {MapStation} from "@/types/map";

interface StationContextType {
  selectedStation: MapStation | undefined;
  setSelectedStation: (station: MapStation | undefined) => void;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const MapStationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedStation, setSelectedStation] = useState<MapStation | undefined>();

  return (
    <StationContext.Provider value={{ selectedStation, setSelectedStation }}>
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
