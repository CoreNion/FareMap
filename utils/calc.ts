import type { FareStation, FareType, JrFareData, SpecialFareTable } from "../types/fare.ts"
import type { SUPPORTED_RAILWAY } from "../types/railway.ts"
import type { Graph } from "../types/graph.ts";
import { loadJson } from "./data.ts";
import { calculateShortDistance } from "./shortestPath.ts";
import { calculateIcFare } from "./icRoute.ts";

/**
 * 営業キロから運賃を求める関数
 * @param distance 営業キロ
 * @param railway 鉄道会社コード
 * @param onlyChihou 地方交通線のみかどうか
 * @param type 運賃の種別
 * @returns 営業キロに対応する運賃
 */
const distanceToFare = async (distance: number, railway: SUPPORTED_RAILWAY, onlyChihou: boolean, type: FareType): Promise<number> => {
  let fareData: JrFareData;
  switch (railway) {
    case 'jre':
      fareData = await loadJson<JrFareData>('/data/jre/fare/fare.json');
      break;
    default:
      throw new Error(`未定義の鉄道会社です: ${railway}`);
  }

  let fare = 0;

  // 1km未満の端数は1kmに切り上げる (距離は0.1km単位)
  distance = Math.max(10, Math.ceil(distance / 10) * 10);

  const table = onlyChihou ? fareData.chihou : fareData.kansen;

  for (const range of table) {
    if (distance >= (range.startK * 10) && distance <= (range.endK * 10)) {
      fare = type === 'ic' ? range.icFare : range.fare;
      break;
    }
  }
  return fare;
}

/**
 * 運賃計算を行う関数
 * - きっぷ運賃: JR線の最短経路で計算する
 * - IC運賃: 他社線を含めた最も安価となる経路で計算する
 * @param startSt 出発駅
 * @param endSt 到着駅
 * @param type 運賃の種別
 * @returns 計算された運賃
 */
export const calculateFare = async (startSt: FareStation, endSt: FareStation, type: FareType = 'ticket'): Promise<number> => {
  if (type === 'ic') {
    const { fare } = await calculateIcFare(startSt.id, endSt.id);
    return fare;
  }
  return calculateJrFare(startSt.id, endSt.id, type);
}

/**
 * JR線のみを利用する場合の運賃計算を行う関数
 *
 * 特定都区市内・東京山手線内の制度はきっぷ・IC運賃の両方で適用する
 * @param startId 出発駅ID
 * @param endId 到着駅ID
 * @param type 運賃の種別
 * @returns 計算された運賃
 */
export const calculateJrFare = async (startId: string, endId: string, type: FareType): Promise<number> => {
  const graph = await loadJson<Graph>('/data/jre/fare/graph.json');
  const specialFareTable = await loadJson<SpecialFareTable>('/data/jre/fare/special.json');

  const startSt = graph.stations?.[startId];
  const endSt = graph.stations?.[endId];
  if (!startSt || !endSt) {
    throw new Error('start または end 駅がグラフに存在しません');
  }

  // 特別な運賃が適用されている場合はそれを返す
  const specialFare = specialFareTable.specialFares.find(
    (s) => (s.to == startId && s.from == endId) || (s.from == startId && s.to == endId)
  );
  if (specialFare) return type === 'ic' ? specialFare.icFare : specialFare.fare;

  // 営業キロの算出を行う
  const { fareDistance, onlyChihou } = calcJrFareDistance(graph, startSt, endSt);

  // 営業キロを運賃に変換
  return distanceToFare(fareDistance, 'jre', onlyChihou, type);
}

/**
 * JR線の2駅間の最短の営業キロを求める関数
 * @param startId 出発駅ID
 * @param endId 到着駅ID
 * @returns 営業キロ (0.1km単位)
 */
export const getJrDistance = async (startId: string, endId: string): Promise<number> => {
  const graph = await loadJson<Graph>('/data/jre/fare/graph.json');
  return calculateShortDistance(graph, startId, endId).operatingDistance;
}

/** JRの特定都区市内ごとの中心駅 */
const JR_SP_CENTER_STATIONS: Record<string, string> = {
  yamanote: "tokyo",
  tokunai: "tokyo",
  yokohama: "yokohama",
  sapporo: "sapporo",
  sendai: "sendai",
  nagoya: "nagoya",
  kyoto: "kyoto",
  osaka: "osaka",
  kobe: "kobe",
  hiroshima: "hiroshima",
  kitakyusyu: "kokura",
  fukuoka: "hakata",
};

/**
 * JR線の営業キロの計算を行う関数
 *
 * - 特定都区市内・東京山手線内の場合の処理に対応
 */
const calcJrFareDistance = (graph: Graph, startSt: FareStation, endSt: FareStation): { fareDistance: number, onlyChihou: boolean } => {
  // 同じ特定都区市内同士の場合は通常通り算出する
  if (startSt.sp.some((sp) => endSt.sp.includes(sp))) {
    return calculateShortDistance(graph, startSt.id, endSt.id);
  }

  // 駅が属する特定都区市内の中心駅を取得する (属していない場合はundefined)
  const getCenterStId = (st: FareStation): string | undefined => {
    const sp = st.sp.find((s) => JR_SP_CENTER_STATIONS[s]);
    return sp ? JR_SP_CENTER_STATIONS[sp] : undefined;
  }

  // 中心駅から相手駅までの営業キロで、中心駅を起点に計算するかを判定する
  // - 特定都区市内: 200kmを超える場合
  // - 東京山手線内: 100kmを超えて200km以下の場合
  const getCalcStId = (st: FareStation, otherSt: FareStation): string => {
    const centerId = getCenterStId(st);
    if (!centerId) return st.id;

    const { operatingDistance } = calculateShortDistance(graph, centerId, otherSt.id);
    if (operatingDistance > 2000) return centerId;
    if (st.sp.includes("yamanote") && operatingDistance > 1000) return centerId;
    return st.id;
  }

  const startCalcStId = getCalcStId(startSt, endSt);
  const endCalcStId = getCalcStId(endSt, startSt);
  return calculateShortDistance(graph, startCalcStId, endCalcStId);
}
