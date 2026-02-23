import { FareStation } from "./fare";

/**
 * 駅間のエッジ（隣接情報）を表す型
 * - `to`: 隣接ノードの station id
 * - `weight`: エッジの重み（運賃計算では営業キロなど）
 * - `type`: 路線上の隣接か、乗換などの補助的なエッジかを区別
 */
export type Edge = { to: string; weight: number; type?: 'line' | 'transfer' };

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