import { FareStation } from "./fare";

/**
 * 駅間のエッジ（隣接情報）を表す型
 * - `to`: 隣接ノードの station id
 * - `weight`: エッジの重み（運賃計算では営業キロなど）
 * - `fareWeight`: 運賃計算用のWeight
 * - `chihou`: 地方交通線の区間かどうか
 */
export type Edge = { to: string; weight: number; fareWeight: number; chihou: boolean };

/**
 * 隣接リスト（駅ID -> Edge の配列）
 * グラフ探索や最短経路計算に直接渡せる形式。
 */
export type Adj = Record<string, Edge[]>;

/**
 * グラフ全体の型
 * - `stations`: 駅辞書（id -> FareStation）
 * - `adj`: 隣接リスト（id -> Edge[]）
 */
export type Graph = {
  stations: Record<string, FareStation>;
  adj: Adj;
};