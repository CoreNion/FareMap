import type { FareSegment, FareType, IcFareResult } from "../types/fare.ts";
import type { Graph } from "../types/graph.ts";
import type { RailwayId } from "../types/railway.ts";
import { loadJson } from "./data.ts";
import { calculateJrFare } from "./calc.ts";
import { calculatePrivateFare } from "./privateFare.ts";
import { RAILWAYS } from "./railway.ts";
import { calcFullyDiscountedTransfers, calcTransferDiscounts, getMaxTransferDiscount } from "./transferDiscount.ts";

/** 改札を通らずに乗り継げる事業者数の上限 (5社線以上は自動精算できない) */
const MAX_RAILWAYS = 4;

/** 事業者をまたぐ経路計算用のネットワーク情報 */
interface IcNetwork {
  /** 駅ID -> その駅を含む事業者の一覧 */
  stationRailways: Map<string, RailwayId[]>;
  /** 事業者 -> その事業者の境界駅(2社以上の路線データに含まれる駅)の一覧 */
  boundaries: Map<RailwayId, string[]>;
}

let networkPromise: Promise<IcNetwork> | undefined;

/**
 * 全事業者のグラフを読み込み、駅ごとの事業者と境界駅を求める関数
 * - 同じ駅IDが複数の事業者にある駅は、改札を通らずに乗り継げる駅として扱う
 */
const loadNetwork = (): Promise<IcNetwork> => {
  networkPromise ??= (async () => {
    const stationRailways = new Map<string, RailwayId[]>();
    for (const railway of RAILWAYS) {
      const graph = await loadJson<Graph>(`/data/${railway}/fare/graph.json`);
      for (const id of Object.keys(graph.stations)) {
        const list = stationRailways.get(id) ?? [];
        list.push(railway);
        stationRailways.set(id, list);
      }
    }

    const boundaries = new Map<RailwayId, string[]>(RAILWAYS.map((r) => [r, []]));
    for (const [id, railways] of stationRailways) {
      if (railways.length < 2) continue;
      for (const r of railways) boundaries.get(r)!.push(id);
    }

    return { stationRailways, boundaries };
  })();
  return networkPromise;
}

/** 1事業者の区間ごとの運賃のキャッシュ (計算できない区間はnull) */
const segmentFareCache = new Map<string, Promise<number | null>>();

/**
 * 1事業者のみを利用する区間の運賃を求める関数
 * @param type 運賃の種別
 * @returns 運賃 (経路が無いなど計算できない場合はnull)
 */
const getSegmentFare = (railway: RailwayId, from: string, to: string, type: FareType): Promise<number | null> => {
  // 運賃は方向に依存しないため、駅IDを並べ替えてキャッシュする
  const key = [type, railway, ...[from, to].sort()].join(':');
  let cached = segmentFareCache.get(key);
  if (!cached) {
    cached = (railway === 'jre'
      ? calculateJrFare(from, to, type)
      : calculatePrivateFare(railway, from, to, type)
    ).catch(() => null);
    segmentFareCache.set(key, cached);
  }
  return cached;
}

/**
 * 事業者をまたぐ経路の運賃計算を行う関数
 *
 * 改札を通らずに乗車した場合の運賃を、以下のルールで計算する
 * - 発駅と着駅がどちらも同じ1事業者のみの駅の場合は、その事業者のみの運賃とする
 *   (JR線〜東京メトロ線〜JR線と直通しても、JR線の運賃とするルールなど)
 * - それ以外は、4社線以内で乗り継げる経路のうち、最も安価となる経路の運賃とする
 *   (同じ事業者を2回以上利用する経路は除く)
 * - 事業者間の乗継割引がある場合は、割引を適用した運賃で比較する
 * - きっぷ運賃の場合は、すべての乗継ぎ箇所に連絡きっぷの乗継割引がある経路のみを対象とする
 * @param startId 出発駅ID
 * @param endId 到着駅ID
 * @param type 運賃の種別
 * @returns 合計運賃と経路の区間・適用した乗継割引
 */
export const calculateRouteFare = async (startId: string, endId: string, type: FareType): Promise<IcFareResult> => {
  const ticketType = type === 'ic' ? 'ic' : 'paper';
  const { stationRailways, boundaries } = await loadNetwork();
  const startRailways = stationRailways.get(startId);
  const endRailways = stationRailways.get(endId);
  if (!startRailways || !endRailways) {
    throw new Error('start または end 駅がグラフに存在しません');
  }

  // 発着駅が同じ1事業者のみの駅の場合は、その事業者のみで計算する
  if (startRailways.length === 1 && endRailways.length === 1 && startRailways[0] === endRailways[0]) {
    const railway = startRailways[0];
    const fare = await getSegmentFare(railway, startId, endId, type);
    if (fare === null) throw new Error('経路が見つかりません');
    return { fare, segments: [{ railway, from: startId, to: endId, fare }], discounts: [] };
  }

  // 経路全体で受けられる乗継割引の上限 (乗継割引は2区間以上に適用するため、4社線では最大2回)
  const maxTotalDiscount = (await getMaxTransferDiscount(ticketType)) * Math.floor(MAX_RAILWAYS / 2);

  let best: IcFareResult | undefined;

  /**
   * 深さ優先探索で経路を列挙する
   * @param stId 現在の駅
   * @param segments ここまでの区間
   * @param total ここまでの合計運賃
   */
  const search = async (stId: string, segments: FareSegment[], total: number) => {
    const usedRailways = segments.map((s) => s.railway);
    const visited = new Set([startId, ...segments.map((s) => s.to)]);
    const railways = (stationRailways.get(stId) ?? []).filter((r) => !usedRailways.includes(r));

    // 着駅まで直接行ける事業者を先に調べる (同額の場合は区間の少ない経路を優先するため)
    for (const railway of railways) {
      if (!endRailways.includes(railway)) continue;
      const fare = await getSegmentFare(railway, stId, endId, type);
      if (fare === null) continue;

      const nextSegments = [...segments, { railway, from: stId, to: endId, fare }];
      // 乗継割引を適用した運賃で比較する
      // (きっぷ運賃は、乗継割引の無い乗継ぎ箇所がある経路を除く)
      const discounts = type === 'ic'
        ? await calcTransferDiscounts(nextSegments, ticketType)
        : await calcFullyDiscountedTransfers(nextSegments, ticketType);
      if (!discounts) continue;
      const nextTotal = total + fare - discounts.reduce((sum, d) => sum + d.amount, 0);
      if (!best || nextTotal < best.fare) {
        best = { fare: nextTotal, segments: nextSegments, discounts };
      }
    }

    // 事業者の上限に達した場合はこれ以上乗り継がない
    if (segments.length + 1 >= MAX_RAILWAYS) return;

    // 境界駅で他の事業者へ乗り継ぐ
    for (const railway of railways) {
      for (const boundaryId of boundaries.get(railway) ?? []) {
        if (boundaryId === endId || visited.has(boundaryId)) continue;
        // 乗り継ぎ先に未利用の事業者が無い境界駅は除く
        const nextRailways = stationRailways.get(boundaryId)!;
        if (!nextRailways.some((r) => r !== railway && !usedRailways.includes(r))) continue;

        const fare = await getSegmentFare(railway, stId, boundaryId, type);
        if (fare === null) continue;
        // 乗継割引を最大限受けても、既に見つかった経路より高くなる場合は打ち切る
        if (best && total + fare - maxTotalDiscount >= best.fare) continue;

        await search(boundaryId, [...segments, { railway, from: stId, to: boundaryId, fare }], total + fare);
      }
    }
  };

  await search(startId, [], 0);

  if (!best) throw new Error('経路が見つかりません');
  return best;
}

/**
 * IC運賃(チャージ残額で乗車する場合)の計算を行う関数
 * @param startId 出発駅ID
 * @param endId 到着駅ID
 * @returns 合計運賃と経路の区間・適用した乗継割引
 */
export const calculateIcFare = (startId: string, endId: string): Promise<IcFareResult> =>
  calculateRouteFare(startId, endId, 'ic');
