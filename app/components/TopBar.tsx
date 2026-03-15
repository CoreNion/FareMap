"use client";

import { useMapStation } from "@/context/StationContext";

export const TopBar = () => {
  const { selectedStation } = useMapStation();

  return (
    <div className="fixed top-0 bg-white rounded-xl p-2 border border-zinc-400 shadow-md z-10 m-3
                    grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 md:grid-cols-1 md:w-auto">
      <h1 className="font-bold text-2xl">Fare Map</h1>
      <h2 className="mt-1 font-normal text-lg">
        {selectedStation ? `${selectedStation.name}駅からの運賃...` : "起点となる駅を選択..." }
      </h2>
    </div>
  );
};