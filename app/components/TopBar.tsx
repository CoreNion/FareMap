"use client";

import { useMapStation } from "@/context/StationContext";
import type { FareType } from "@/types/fare";

/** 運賃の種別ごとの表示名 */
const FARE_TYPE_LABELS: Record<FareType, string> = {
  ticket: "きっぷ",
  ic: "IC",
};

export const TopBar = () => {
  const { selectedStation, fareType, setFareType, railMode, viaStation, viaPanelOpen } = useMapStation();

  // 運賃の算出方法の補足
  const fareNote = fareType === "ic" ? " (最安経路)..." :
    railMode === "jr" ? " (JR東日本線経由)..." :
    railMode === "private" ? " (乗継割引のある経路)..." : " (JR線・乗継割引の安い方)...";

  return (
    <header className="select-none pointer-events-auto relative w-full bg-white p-2 md:px-4 md:border border-zinc-400 shadow-md md:mx-auto md:rounded-3xl md:w-180
                       grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <h1 className="font-bold text-lg md:text-2xl">Fare Map</h1>
      <h2 className="font-normal break-keep md:text-lg md:text-center">
        {selectedStation ?
          <>{railMode === "jr" ? "JR" : ""}{selectedStation.name}駅からの<wbr />{fareType === "ic" ? "IC" : "切符"}運賃<wbr />
            {fareNote}</>
          : railMode === "private" ? "起点となる私鉄の駅を選択..." : "起点となる駅を選択..."}
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
      {/* 経由駅の指定パネルを開いていて、経由駅が未指定の場合の案内
          (スマホではヘッダーの最下段に、それ以外ではヘッダーの直下の中央に表示する) */}
      {selectedStation && viaPanelOpen && !viaStation &&
        <p role="status"
          className="col-span-3 justify-self-center md:absolute md:top-full md:mt-2 md:left-1/2 md:-translate-x-1/2 px-4 py-1.5 rounded-full bg-sky-600 text-white text-sm font-bold shadow-md break-keep">
          経由駅を指定してください
          <span className="ml-2 text-xs font-normal">(地図の駅を選択)</span>
        </p>
      }
    </header>
  );
};
