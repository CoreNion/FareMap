import type { MapStation } from "./map.ts";

/**
 * 改札外乗り換えの経由駅
 * - `alight`: 発駅から乗車して改札を出る駅
 * - `board`: 改札外を移動して再び乗車する駅 (降車駅と同じ場合は同じ駅で改札を出て入り直す)
 */
export interface ViaStation {
  alight: MapStation;
  board: MapStation;
}

/** 降車駅の近くにある、別の駅IDの乗換候補の駅 */
export interface TransferCandidate {
  station: MapStation;
  /** 降車駅からの直線距離 (m) */
  distance: number;
}
