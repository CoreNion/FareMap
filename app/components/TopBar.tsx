"use client";

import { useMapStation } from "@/context/StationContext";

export const TopBar = () => {
  const { selectedStation } = useMapStation();

  return (
    <header className="select-none fixed top-0 left-0 right-0 md:top-5 bg-white p-2 md:px-4 md:border border-zinc-400 shadow-md z-10 md:m-auto md:rounded-3xl md:w-180
                       grid grid-cols-[auto_auto] md:grid-cols-[auto_1fr] items-center gap-3">
      <h1 className="font-bold text-lg md:text-2xl">Fare Map</h1>
      <h2 className="font-normal break-keep md:text-lg md:text-center">
        {selectedStation ? <>JR{selectedStation.name}駅からの<wbr />切符運賃<wbr /> (JR東日本線経由)...</> : "起点となる駅を選択..." }
      </h2>
    </header>
  );
};