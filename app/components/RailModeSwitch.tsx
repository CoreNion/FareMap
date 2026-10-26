"use client";

import { useMapStation } from "@/context/StationContext";
import type { RailMode } from "@/types/map";

/** 路線の区分ごとの表示名 */
const RAIL_MODE_LABELS: Record<RailMode, string> = {
  jr: "JR線",
  private: "私鉄線",
  all: "全線",
};

/** 切り替えボタンのスタイル */
const toggleClassName = (pressed: boolean): string =>
  `px-3 py-1 rounded-full border border-zinc-400 shadow-md text-xs font-bold cursor-pointer break-keep ${pressed ? "bg-green-600 text-white" : "bg-white hover:bg-green-100"}`;

/**
 * 画面右上に表示する、JR線・私鉄線・全線の切り替えボタン
 * - 発駅を選択している場合は、営業キロにかかわらず全駅を表示するかの切り替えも表示する
 */
export const RailModeSwitch = () => {
  const {
    railMode, setRailMode, selectedStation, showAllStations, setShowAllStations,
  } = useMapStation();

  return (
    <div className="select-none pointer-events-auto ml-auto flex flex-col items-end gap-2 lg:fixed lg:top-5 lg:right-5">
      <div role="group" aria-label="表示する路線"
        className="flex rounded-full border border-zinc-400 overflow-hidden shadow-md text-sm font-bold">
        {(Object.keys(RAIL_MODE_LABELS) as RailMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={railMode === mode}
            className={`px-3 py-1.5 md:py-2 cursor-pointer break-keep ${railMode === mode ? "bg-green-600 text-white" : "bg-white hover:bg-green-100"}`}
            onClick={() => setRailMode(mode)}
          >
            {RAIL_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      {selectedStation &&
        <button
          type="button"
          aria-pressed={showAllStations}
          title="物理的な距離に比べて営業キロが大きすぎる(遠回りになる)駅も表示します"
          className={toggleClassName(showAllStations)}
          onClick={() => setShowAllStations(!showAllStations)}
        >
          全駅表示: {showAllStations ? "オン" : "オフ"}
        </button>
      }
    </div>
  );
};
