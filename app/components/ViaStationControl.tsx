"use client";

import { useEffect, useState } from "react";

import { useMapStation } from "@/context/StationContext";
import type { MapStation } from "@/types/map";
import type { TransferCandidate } from "@/types/via";
import { RAILWAY_SHORT_NAMES } from "@/utils/railway";
import { findTransferCandidates } from "@/utils/viaStation";

/** 駅の事業者の略称 (私鉄線モードのみ) */
const railwayLabel = (station: MapStation): string =>
  station.railways?.map((r) => RAILWAY_SHORT_NAMES[r]).join("・") ?? "";

/** 乗車駅の選択肢のボタンのスタイル */
const optionClassName = (selected: boolean): string =>
  `px-2 py-1 rounded-lg border text-left cursor-pointer ${selected ? "bg-green-600 border-green-600 text-white" : "bg-white border-zinc-300 hover:bg-green-100"}`;

/**
 * 画面右上に表示する、改札外乗り換えの経由駅の指定
 * - 経由駅(降車駅)は地図の駅のポップアップから手動で指定する
 * - 降車駅の近くにある別の駅(物理的には近いが運賃計算上は遠い駅)を、乗車駅の候補として一覧表示する
 */
export const ViaStationControl = () => {
  const {
    selectedStation, railMode, viaStation, setViaBoardStation, clearViaStation,
    viaPanelOpen: open, setViaPanelOpen: setOpen,
  } = useMapStation();
  // 候補を求めた降車駅のIDと一緒に保持し、降車駅の変更直後に古い候補を表示しないようにする
  const [candidates, setCandidates] = useState<{ alightId: string; list: TransferCandidate[] } | null>(null);

  const alight = viaStation?.alight;

  useEffect(() => {
    if (!alight) return undefined;
    // 降車駅を素早く切り替えた際に、古い結果で上書きしないためのフラグ
    let cancelled = false;
    (async () => {
      const list = await findTransferCandidates(railMode, alight);
      if (!cancelled) setCandidates({ alightId: alight.id, list });
    })();
    return () => {
      cancelled = true;
    };
    // 降車駅のIDが変わった場合のみ再計算する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railMode, alight?.id]);

  // 発駅の選択前は経由駅を指定できない
  if (!selectedStation) return null;

  const candidateList = alight && candidates?.alightId === alight.id ? candidates.list : undefined;
  // 候補の一覧以外から手動で指定した乗車駅
  const manualBoard = viaStation && viaStation.board.id !== viaStation.alight.id
    && !candidateList?.some((c) => c.station.id === viaStation.board.id) ? viaStation.board : undefined;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        aria-expanded={open}
        className={`px-3 py-1 rounded-full border border-zinc-400 shadow-md text-xs font-bold cursor-pointer break-keep ${viaStation ? "bg-sky-600 text-white" : "bg-white hover:bg-green-100"}`}
        onClick={() => setOpen(!open)}
      >
        経由駅: {viaStation ?
          (viaStation.board.id === viaStation.alight.id ? `${viaStation.alight.name}` : `${viaStation.alight.name}→${viaStation.board.name}`)
          : "指定なし"}
      </button>
      {open &&
        <section aria-label="経由駅の指定"
          className="w-64 max-h-[60dvh] overflow-y-auto p-3 bg-white rounded-2xl border border-zinc-400 shadow-md text-xs grid gap-2">
          <h2 className="font-bold text-sm">経由駅 (改札外乗り換え)</h2>
          {!viaStation ?
            <p className="text-zinc-600">地図の駅を選び、ポップアップの「経由駅に指定」から改札を出る駅を指定します。</p> :
            <>
              <p>
                <span className="text-zinc-600">改札を出る駅: </span>
                <strong>{viaStation.alight.name}駅</strong>
                {railwayLabel(viaStation.alight) && <span className="text-zinc-600"> ({railwayLabel(viaStation.alight)})</span>}
              </p>
              <div className="grid gap-1">
                <span className="text-zinc-600">乗車する駅:</span>
                <button type="button" aria-pressed={viaStation.board.id === viaStation.alight.id}
                  className={optionClassName(viaStation.board.id === viaStation.alight.id)}
                  onClick={() => setViaBoardStation(viaStation.alight)}>
                  同じ駅から乗車
                </button>
                {manualBoard &&
                  <button type="button" aria-pressed={true} className={optionClassName(true)}>
                    {manualBoard.name}駅 {railwayLabel(manualBoard) && `(${railwayLabel(manualBoard)})`} (手動で指定)
                  </button>
                }
                {candidateList === undefined ?
                  <span className="text-zinc-500">近くの駅を検索中...</span> :
                  candidateList.length === 0 ?
                    <span className="text-zinc-500">近くに乗り換えられる別の駅はありません</span> :
                    candidateList.map(({ station, distance }) => {
                      const selected = viaStation.board.id === station.id;
                      return (
                        <button key={station.id} type="button" aria-pressed={selected}
                          className={optionClassName(selected)}
                          onClick={() => setViaBoardStation(station)}>
                          {station.name}駅 {railwayLabel(station) && `(${railwayLabel(station)})`}
                          <span className={selected ? "" : "text-zinc-500"}> 約{Math.round(distance / 10) * 10}m</span>
                        </button>
                      );
                    })
                }
                <p className="text-zinc-500">一覧に無い駅は、地図の駅のポップアップから乗換駅に指定できます。</p>
              </div>
              <button type="button"
                className="px-2 py-1 rounded-full bg-zinc-200 font-bold cursor-pointer hover:bg-zinc-300"
                onClick={clearViaStation}>
                経由駅の指定を解除
              </button>
            </>
          }
        </section>
      }
    </div>
  );
};
