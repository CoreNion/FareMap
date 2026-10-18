"use client";

import { useMapStation } from "@/context/StationContext";
import type { RailMode } from "@/types/map";

/** 路線の区分ごとの表示名 */
const RAIL_MODE_LABELS: Record<RailMode, string> = {
  jr: "JR線",
  private: "私鉄線",
};

/** 画面右上に表示する、JR線と私鉄線の切り替えボタン */
export const RailModeSwitch = () => {
  const { railMode, setRailMode } = useMapStation();

  return (
    <div role="group" aria-label="表示する路線"
      className="select-none fixed right-2 top-18 md:top-22 md:right-5 lg:top-5 z-10 flex rounded-full border border-zinc-400 overflow-hidden shadow-md text-sm font-bold">
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
  );
};
