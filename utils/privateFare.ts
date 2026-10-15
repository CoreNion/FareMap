import type { FareType, ICFareRange, KasanFare, PrivateFareData, SpecialFareTable } from "../types/fare.ts";
import type { Graph } from "../types/graph.ts";
import type { PrivateRailwayId } from "../types/railway.ts";
import { loadJson, loadOptionalJson } from "./data.ts";
import { calculateShortDistance } from "./shortestPath.ts";

/**
 * 営業キロ(0.1km単位)に対応する運賃を運賃表から求める関数
 * - 1km未満の端数は1kmに切り上げる
 * @returns 対応する運賃 (運賃表の範囲外の場合はundefined)
 */
const findRangeFare = (ranges: ICFareRange[], distance: number, type: FareType): number | undefined => {
  const km = Math.max(1, Math.ceil(distance / 10));
  const range = ranges.find((r) => km >= r.startK && km <= r.endK);
  if (!range) return undefined;
  return type === 'ic' ? range.icFare : range.fare;
}

/**
 * 経路上の加算運賃の合計を求める関数
 * - `additional`: 経路上(発着駅を含む)に加算区間の駅があれば1回だけ加算する
 * - `additional_range`: 加算区間内を乗車したキロに応じて加算する
 *   加算区間の駅同士の間に加えて、加算区間の駅と加算運賃の無い駅の間(区間の境界)も加算区間内として数える
 * @param graph 事業者のグラフ
 * @param kasanList 事業者の加算運賃の一覧
 * @param path 経路上の駅ID
 * @param type 運賃の種別
 */
const calcKasanFare = (graph: Graph, kasanList: KasanFare[], path: string[], type: FareType): number => {
  const kasanIds = new Set(kasanList.map((k) => k.id));
  // 駅が属する加算区間のIDの一覧
  const getKasanIds = (stId: string): string[] => (graph.stations[stId]?.sp ?? []).filter((sp) => kasanIds.has(sp));

  let total = 0;
  for (const kasan of kasanList) {
    if (kasan.kinds === 'additional') {
      if (path.some((stId) => getKasanIds(stId).includes(kasan.id))) {
        total += (type === 'ic' ? kasan.icFare : undefined) ?? kasan.fare;
      }
      continue;
    }

    // 加算区間内の営業キロを合計する
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      const a = getKasanIds(path[i - 1]);
      const b = getKasanIds(path[i]);
      const inA = a.includes(kasan.id);
      const inB = b.includes(kasan.id);
      const inSection = (inA && inB) || (inA && b.length === 0) || (inB && a.length === 0);
      if (!inSection) continue;

      const edges = (graph.adj[path[i - 1]] ?? []).filter((e) => e.to === path[i]);
      distance += Math.min(...edges.map((e) => e.weight));
    }
    if (distance > 0) {
      const fare = findRangeFare(kasan.ranges, distance, type);
      if (fare === undefined) throw new Error(`加算運賃の範囲外です: ${kasan.id} ${distance}`);
      total += fare;
    }
  }
  return total;
}

/**
 * 私鉄・地下鉄の1事業者のみを利用する場合の運賃計算を行う関数
 * - 最短の営業キロで計算し、特別な運賃・加算運賃を考慮する
 * @param railway 事業者ID
 * @param startId 出発駅ID
 * @param endId 到着駅ID
 * @param type 運賃の種別
 * @returns 計算された運賃
 */
export const calculatePrivateFare = async (railway: PrivateRailwayId, startId: string, endId: string, type: FareType): Promise<number> => {
  const graph = await loadJson<Graph>(`/data/${railway}/fare/graph.json`);
  const fareData = await loadJson<PrivateFareData>(`/data/${railway}/fare/fare.json`);
  const specialFareTable = await loadOptionalJson<SpecialFareTable>(`/data/${railway}/fare/special.json`);

  if (!graph.stations[startId] || !graph.stations[endId]) {
    throw new Error(`start または end 駅が${railway}のグラフに存在しません`);
  }

  // 特別な運賃が適用されている場合はそれを返す
  const specialFare = specialFareTable?.specialFares.find(
    (s) => (s.to == startId && s.from == endId) || (s.from == startId && s.to == endId)
  );
  if (specialFare) return type === 'ic' ? specialFare.icFare : specialFare.fare;

  const { operatingDistance, path } = calculateShortDistance(graph, startId, endId);
  const fare = findRangeFare(fareData.normal, operatingDistance, type);
  if (fare === undefined) throw new Error(`運賃表の範囲外です: ${railway} ${startId} -> ${endId}`);

  return fare + calcKasanFare(graph, fareData.kasan ?? [], path, type);
}
