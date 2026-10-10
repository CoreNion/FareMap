"use client";

import { useMapStation } from "@/context/StationContext";
import { RAILWAYS } from "@/utils/railway";

export const TopBar = () => {
  const { railway, changeRailway, selectedStation } = useMapStation();
  const railwayInfo = RAILWAYS[railway];

  return (
    <header className="select-none fixed top-0 left-0 right-0 md:top-5 bg-white p-2 md:px-4 md:border border-zinc-400 shadow-md z-10 md:m-auto md:rounded-3xl md:w-180
                       grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1">
      <h1 className="font-bold text-lg md:text-2xl">Fare Map</h1>
      <h2 className="font-normal break-keep md:text-lg md:text-center row-start-2 col-span-2 md:row-start-1 md:col-start-2 md:col-span-1">
        {selectedStation ? <>{railwayInfo.prefix}{selectedStation.name}駅からの<wbr />切符運賃<wbr /> ({railwayInfo.note})...</> : "起点となる駅を選択..." }
      </h2>
      {/* 表示する鉄道事業者の切り替え */}
      <div className="justify-self-end flex rounded-full border border-zinc-400 overflow-hidden text-xs md:text-sm" role="group" aria-label="鉄道事業者">
        {Object.values(RAILWAYS).map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === railway}
            className={`px-2 py-1 cursor-pointer ${r.id === railway ? "bg-green-200 font-bold" : "hover:bg-zinc-100"}`}
            onClick={() => changeRailway(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>
    </header>
  );
};
