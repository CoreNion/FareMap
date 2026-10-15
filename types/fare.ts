import type { RailwayId } from "./railway.ts";

/** 運賃の種別 (ticket: きっぷ運賃, ic: IC運賃) */
export type FareType = 'ticket' | 'ic';

/** 営業キロごとの運賃 */
export interface BaseFareRange {
  startK: number;
  endK: number;
  fare: number;
}

/** 営業キロごとの運賃(IC対応) */
export interface ICFareRange extends BaseFareRange {
  icFare: number;
}

/** JRの運賃データ */
export interface JrFareData {
  kansen: ICFareRange[];
  chihou: ICFareRange[];
  kasan: BaseFareRange[];
}

/** 加算運賃(加算区間の駅を利用した場合に定額を加算) */
export interface FixedKasanFare {
  kinds: 'additional';
  /** 駅データの`sp`から参照される加算運賃のID */
  id: string;
  fare: number;
  icFare?: number;
}

/** 加算運賃(加算区間内の営業キロに応じて加算) */
export interface RangeKasanFare {
  kinds: 'additional_range';
  /** 駅データの`sp`から参照される加算運賃のID */
  id: string;
  ranges: ICFareRange[];
}

/** 私鉄の加算運賃 */
export type KasanFare = FixedKasanFare | RangeKasanFare;

/** JR以外(私鉄・地下鉄)の運賃データ */
export interface PrivateFareData {
  /** 営業キロごとの普通運賃 */
  normal: ICFareRange[];
  /** 加算運賃(加算運賃が無い事業者は省略) */
  kasan?: KasanFare[];
}

/** 運賃計算用の駅データ */
export interface FareStation {
  name: string;
  id: string;
  km: number;
  sp: string[];
}
export interface JrFareStation extends FareStation {
  fareKm: number;
}

/** 運賃計算上の路線 */
export interface FareLine {
  id: string;
  stations: FareStation[];
}
export interface JrFareLine extends FareLine {
  chihou: boolean;
}

export interface FareLines extends FareLine {
  lines: FareLine[];
}

/** 運賃計算上の路線情報 */
export interface FareLineInfo {
  name: string;
  id: string;
  children?: FareLineInfo[];
}
/** 運賃計算上の路線一覧 */
export interface FareLineList {
  lines: FareLineInfo[]
}

/** 駅ごとの各駅への運賃表 */
export interface FareTable {
  id: string;
  name: string;
  fares: {
    [destinationId: string]: number | null;
  }
  /** JR線のみではない経路で運賃を算出した駅の、利用する事業者の並び (IC運賃の表のみ) */
  via?: {
    [destinationId: string]: RailwayId[];
  }
}

/**
 * 特定の区間の特別な運賃
 */
export interface SpecialFareTable {
  specialFares: SpecialFare[]
}
export interface SpecialFare {
  from: string
  to: string,
  fare: number,
  icFare: number
}

/** 事業者をまたぐ経路のうち、1事業者を利用する区間 */
export interface FareSegment {
  railway: RailwayId;
  from: string;
  to: string;
  fare: number;
}

/** IC運賃の計算結果 */
export interface IcFareResult {
  /** 合計のIC運賃 */
  fare: number;
  /** 運賃を算出した経路の区間 */
  segments: FareSegment[];
}
