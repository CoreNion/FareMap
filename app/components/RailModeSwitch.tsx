"use client";

import { useMapStation } from "@/context/StationContext";
import type { RailMode } from "@/types/map";
import { ViaStationControl } from "./ViaStationControl";

/** 路線の区分ごとの表示名 */
const RAIL_MODE_LABELS: Record<RailMode, string> = {
  jr: "JR線",
  private: "私鉄線",
};

/**
 * 画面右上に表示する、JR線と私鉄線の切り替えボタン
 * - 発駅を選択している場合は、もう一方の区分の駅(私鉄線モードではJR線の駅、JR線モードでは私鉄線の駅)の
 *   表示/非表示の切り替えも表示する
 * - 発駅を選択している場合は、改札外乗り換えの経由駅の指定も表示する
 */
export const RailModeSwitch = () => {
  const {
    railMode, setRailMode, selectedStation, showJrStations, setShowJrStations, showPrivateStations, setShowPrivateStations,
  } = useMapStation();

  // 表示中の区分ごとの、もう一方の区分の駅の表示の切り替え
  const otherStations = railMode === "private" ?
    { label: "JR線の駅", show: showJrStations, setShow: setShowJrStations } :
    { label: "私鉄線の駅", show: showPrivateStations, setShow: setShowPrivateStations };

  return (
    <div className="select-none fixed right-2 top-18 md:top-22 md:right-5 lg:top-5 z-10 flex flex-col items-end gap-2">
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
          aria-pressed={otherStations.show}
          className={`px-3 py-1 rounded-full border border-zinc-400 shadow-md text-xs font-bold cursor-pointer break-keep ${otherStations.show ? "bg-green-600 text-white" : "bg-white hover:bg-green-100"}`}
          onClick={() => otherStations.setShow(!otherStations.show)}
        >
          {otherStations.label}: {otherStations.show ? "表示中" : "非表示"}
        </button>
      }
      <ViaStationControl />
    </div>
  );
};
