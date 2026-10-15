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
 *
 * 加算区間は、区間の両端を含む駅の`sp`に加算運賃のIDを持たせて表す
 * - 両端の駅が加算区間に含まれる駅間を、加算区間内の乗車として扱う
 * - 加算区間の駅が1駅のみの場合(駅の利用で加算する場合)は、経路上(発着駅を含む)にその駅があれば加算区間内の乗車として扱う
 *
 * `additional`は加算区間内を乗車した場合に1回だけ加算し、`additional_range`は加算区間内を乗車したキロに応じて加算する
 * @param graph 事業者のグラフ
 * @param kasanList 事業者の加算運賃の一覧
 * @param path 経路上の駅ID
 * @param type 運賃の種別
 */
const calcKasanFare = (graph: Graph, kasanList: KasanFare[], path: string[], type: FareType): number => {
  const inKasan = (stId: string, kasanId: string): boolean => graph.stations[stId]?.sp.includes(kasanId) ?? false;

  let total = 0;
  for (const kasan of kasanList) {
    // 加算区間内の駅間を乗車した営業キロを合計する
    let distance = 0;
    let rideInSection = false;
    for (let i = 1; i < path.length; i++) {
      if (!inKasan(path[i - 1], kasan.id) || !inKasan(path[i], kasan.id)) continue;

      const edges = (graph.adj[path[i - 1]] ?? []).filter((e) => e.to === path[i]);
      distance += Math.min(...edges.map((e) => e.weight));
      rideInSection = true;
    }

    // 加算区間の駅が1駅のみの場合は、その駅の利用で判定する
    const isSingleStation = Object.values(graph.stations).filter((st) => st.sp.includes(kasan.id)).length === 1;
    if (isSingleStation && path.some((stId) => inKasan(stId, kasan.id))) {
      rideInSection = true;
    }

    if (kasan.kinds === 'additional') {
      if (rideInSection) {
        total += (type === 'ic' ? kasan.icFare : undefined) ?? kasan.fare;
      }
      continue;
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
