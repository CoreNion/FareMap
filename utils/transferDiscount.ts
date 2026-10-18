import type { AppliedTransferDiscount, FareSegment, TransferDiscount, TransferDiscountData, TransferDiscountSection, TransferDiscountTicketType } from "../types/fare.ts";
import { loadOptionalJson } from "./data.ts";
import { RAILWAYS, toRailwayId } from "./railway.ts";

/** 乗継割引の候補 (経路のどの区間からどの区間までに適用するか) */
interface DiscountCandidate {
  /** 割引の対象となる最初の区間の位置 */
  start: number;
  /** 割引の対象となる最後の区間の位置 */
  end: number;
  discount: AppliedTransferDiscount;
}

/** 乗車券の種別ごとの乗継割引の読み込み結果 */
const rulesPromises = new Map<TransferDiscountTicketType, Promise<TransferDiscount[]>>();

/**
 * 全事業者の乗継割引のうち、指定した乗車券の種別に適用できるものを読み込む関数
 * - 同じ割引は両社のデータに同じIDで収録されているため、IDで重複を除く
 * @param ticketType 乗車券の種別 (paper: 連絡きっぷ, ic: ICカード乗車券)
 */
export const loadTransferDiscounts = (ticketType: TransferDiscountTicketType = 'ic'): Promise<TransferDiscount[]> => {
  let promise = rulesPromises.get(ticketType);
  if (!promise) {
    promise = (async () => {
      const rules = new Map<string, TransferDiscount>();
      for (const railway of RAILWAYS) {
        const data = await loadOptionalJson<TransferDiscountData>(`/data/${railway}/fare/transfer-discounts.json`);
        for (const rule of data?.rules ?? []) {
          if (!rule.ticketTypes.includes(ticketType)) continue;
          if (!rules.has(rule.id)) rules.set(rule.id, rule);
        }
      }
      return [...rules.values()];
    })();
    rulesPromises.set(ticketType, promise);
  }
  return promise;
}

/**
 * 乗継割引の大人の割引額を求める関数
 *
 * TODO: `overrides`(北総線の一部区間で割引額を置き換える設定)は、北総線の駅データを追加したら対応する
 */
const getAdultDiscount = (rule: TransferDiscount): number =>
  rule.kind === 'combinedFare' ? rule.calculation.adultDiscount : rule.discount.adult;

/** 乗継割引の最大の割引額 (経路探索の打ち切りに使う) */
export const getMaxTransferDiscount = async (ticketType: TransferDiscountTicketType = 'ic'): Promise<number> => {
  const rules = await loadTransferDiscounts(ticketType);
  return Math.max(0, ...rules.map(getAdultDiscount));
}

/** 駅が乗継割引の対象区間の発着駅かどうか */
const isSectionStation = (section: TransferDiscountSection, railway: string, stId: string): boolean => {
  if (toRailwayId(section.operator) !== railway) return false;
  if ('allStations' in section) return true;
  return section.stations.some((s) => s.id === stId);
}

/**
 * 区間の並びに対して乗継割引が適用できるかを判定する関数
 * - 対象区間の発着駅は、乗継割引の両端の区間の外側の駅(最初の区間の乗車駅・最後の区間の降車駅)で判定する
 * - 接続駅の指定がある場合は、2つの区間の乗換駅が接続駅と一致する場合のみ適用する
 * - 経由が必須の事業者がある場合は、両端の区間の間がその事業者の並びと一致する場合のみ適用する
 * @param rule 乗継割引
 * @param segments 割引の対象となる区間の並び
 * @param reversed 対象区間の順番を逆にして判定するか
 */
const matchesRule = (rule: TransferDiscount, segments: FareSegment[], reversed: boolean): boolean => {
  const [boardSection, alightSection] = reversed ? [rule.sections[1], rule.sections[0]] : rule.sections;
  const first = segments[0];
  const last = segments[segments.length - 1];

  if (!isSectionStation(boardSection, first.railway, first.from)) return false;
  if (!isSectionStation(alightSection, last.railway, last.to)) return false;

  // 経由する事業者の並びを判定する
  const via = rule.viaOperators ?? [];
  const actualVia = segments.slice(1, -1).map((s) => s.railway);
  const expectedVia = (reversed ? [...via].reverse() : via).map(toRailwayId);
  if (actualVia.length !== expectedVia.length || actualVia.some((r, i) => r !== expectedVia[i])) return false;

  // 接続駅を判定する (経由する事業者が無い場合のみ指定がある)
  if (rule.connection && segments.length === 2) {
    const transferId = first.to;
    const connectionOf = (railway: string) => rule.connection!.find((c) => toRailwayId(c.operator) === railway);
    if (connectionOf(first.railway)?.id !== transferId) return false;
    if (connectionOf(last.railway)?.id !== transferId) return false;
  }

  return true;
}

/**
 * 経路に適用する乗継割引を、対象の区間の範囲とともに求める関数
 * - 1回の乗車で複数の乗継割引が対象になる場合は、対象の区間が重複しない範囲で適用する
 *   (区間が重複する場合は、割引額の合計が最も大きくなる組み合わせを選ぶ)
 * @param segments 経路の区間
 * @param ticketType 乗車券の種別
 * @returns 適用する乗継割引の候補
 */
const findTransferDiscounts = async (segments: FareSegment[], ticketType: TransferDiscountTicketType): Promise<DiscountCandidate[]> => {
  if (segments.length < 2) return [];
  const rules = await loadTransferDiscounts(ticketType);

  // 経路の区間の並びごとに、適用できる乗継割引の候補を列挙する
  const candidates: DiscountCandidate[] = [];
  for (const rule of rules) {
    const length = 2 + (rule.viaOperators?.length ?? 0);
    for (let start = 0; start + length <= segments.length; start++) {
      const target = segments.slice(start, start + length);
      const matched = matchesRule(rule, target, false) || (rule.bidirectional && matchesRule(rule, target, true));
      if (!matched) continue;
      candidates.push({
        start,
        end: start + length - 1,
        discount: { id: rule.id, amount: getAdultDiscount(rule) },
      });
    }
  }

  // 区間が重複しない候補の組み合わせのうち、割引額の合計が最大のものを選ぶ
  // (経路は4社線以内のため、候補の数は少なく全探索で十分)
  let best: DiscountCandidate[] = [];
  let bestAmount = 0;
  const search = (index: number, selected: DiscountCandidate[], amount: number) => {
    if (amount > bestAmount) {
      best = selected;
      bestAmount = amount;
    }
    for (let i = index; i < candidates.length; i++) {
      const c = candidates[i];
      if (selected.some((s) => c.start <= s.end && s.start <= c.end)) continue;
      search(i + 1, [...selected, c], amount + c.discount.amount);
    }
  };
  search(0, [], 0);

  return best;
}

/**
 * 経路に適用する乗継割引を求める関数
 * @param segments 経路の区間
 * @param ticketType 乗車券の種別
 * @returns 適用する乗継割引
 */
export const calcTransferDiscounts = async (segments: FareSegment[], ticketType: TransferDiscountTicketType = 'ic'): Promise<AppliedTransferDiscount[]> => {
  const applied = await findTransferDiscounts(segments, ticketType);
  return applied.map((c) => c.discount);
}

/**
 * 経路のすべての乗継ぎ箇所に乗継割引が適用されるかを判定し、適用する乗継割引を求める関数
 * - 連絡きっぷの運賃は、乗継割引のある事業者間の乗継ぎのみ計算するために使う
 * @param segments 経路の区間
 * @param ticketType 乗車券の種別
 * @returns 適用する乗継割引 (乗継割引の無い乗継ぎ箇所がある場合はnull)
 */
export const calcFullyDiscountedTransfers = async (segments: FareSegment[], ticketType: TransferDiscountTicketType): Promise<AppliedTransferDiscount[] | null> => {
  const applied = await findTransferDiscounts(segments, ticketType);
  // 区間iと区間i+1の間の乗継ぎ箇所が、いずれかの割引の対象範囲に含まれるかを判定する
  for (let i = 0; i + 1 < segments.length; i++) {
    if (!applied.some((c) => c.start <= i && i + 1 <= c.end)) return null;
  }
  return applied.map((c) => c.discount);
}
