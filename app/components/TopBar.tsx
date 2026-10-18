"use client";

import { useMapStation } from "@/context/StationContext";
import type { FareType } from "@/types/fare";

/** 運賃の種別ごとの表示名 */
const FARE_TYPE_LABELS: Record<FareType, string> = {
  ticket: "きっぷ",
  ic: "IC",
};

export const TopBar = () => {
  const { selectedStation, fareType, setFareType, railMode } = useMapStation();

  // 運賃の算出方法の補足
  const fareNote = fareType === "ic" ? " (最安経路)..." :
    railMode === "jr" ? " (JR東日本線経由)..." : " (乗継割引のある経路)...";

  return (
    <header className="select-none fixed top-0 left-0 right-0 md:top-5 bg-white p-2 md:px-4 md:border border-zinc-400 shadow-md z-10 md:m-auto md:rounded-3xl md:w-180
                       grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <h1 className="font-bold text-lg md:text-2xl">Fare Map</h1>
      <h2 className="font-normal break-keep md:text-lg md:text-center">
        {selectedStation ?
          <>{railMode === "jr" ? "JR" : ""}{selectedStation.name}駅からの<wbr />{fareType === "ic" ? "IC" : "切符"}運賃<wbr />
            {fareNote}</>
          : railMode === "jr" ? "起点となる駅を選択..." : "起点となる私鉄の駅を選択..."}
      </h2>
      {/* 運賃の種別の切り替え */}
      <div role="group" aria-label="運賃の種別" className="flex rounded-full border border-zinc-400 overflow-hidden text-sm font-bold">
        {(Object.keys(FARE_TYPE_LABELS) as FareType[]).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={fareType === type}
            className={`px-3 py-1 cursor-pointer break-keep ${fareType === type ? "bg-green-600 text-white" : "bg-white hover:bg-green-100"}`}
            onClick={() => setFareType(type)}
          >
            {FARE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </header>
  );
};
