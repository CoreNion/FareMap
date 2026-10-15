import type { OperatorId, RailwayId } from "./railway.ts";

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

/** 経路に適用した乗継割引 */
export interface AppliedTransferDiscount {
  /** 乗継割引のID */
  id: string;
  /** 割引額 */
  amount: number;
}

/** IC運賃の計算結果 */
export interface IcFareResult {
  /** 合計のIC運賃 (乗継割引の適用後) */
  fare: number;
  /** 運賃を算出した経路の区間 */
  segments: FareSegment[];
  /** 適用した乗継割引 */
  discounts: AppliedTransferDiscount[];
}

/** 乗継割引を適用する乗車券の種別 (paper: 連絡きっぷ, ic: ICカード乗車券) */
export type TransferDiscountTicketType = 'paper' | 'ic';

/** 乗継割引の駅 (運賃データが未収録の事業者の駅はidがnull) */
export interface TransferDiscountStation {
  id: string | null;
  name: string;
}

/** 乗継割引の接続駅 */
export interface TransferDiscountConnection extends TransferDiscountStation {
  operator: OperatorId;
}

/** 乗継割引の対象区間 (1事業者分) */
export type TransferDiscountSection =
  | {
    operator: OperatorId;
    /** 事業者の全駅が対象 */
    allStations: true;
  }
  | {
    operator: OperatorId;
    /** 対象の発着駅 */
    stations: TransferDiscountStation[];
  };

/** 乗継割引の割引額 */
export interface TransferDiscountAmount {
  adult: number;
  child: number;
}

/** 端数処理の方法 */
export interface FareRounding {
  mode: 'ceil' | 'floor';
  /** 端数処理の単位 (円) */
  unit: number;
}

/** 特定の駅の範囲で割引額を置き換える設定 */
export interface TransferDiscountOverride {
  /** 駅の範囲を判定する事業者 */
  sectionOperator: OperatorId;
  /** 対象の駅の範囲 (駅名) */
  stationRange: {
    from: string;
    to: string;
    inclusive: boolean;
  };
  discount: TransferDiscountAmount;
}

/** 乗継割引の共通項目 */
interface BaseTransferDiscount {
  /** 割引制度・接続駅・対象区間を識別するID (同じIDは同じ割引) */
  id: string;
  /** 往復どちらの向きでも適用するか (falseの場合はsectionsの順に乗車する場合のみ) */
  bidirectional: boolean;
  /** 両社の接続駅 (省略時は接続駅を問わない) */
  connection?: TransferDiscountConnection[];
  /** 両社の対象区間 */
  sections: [TransferDiscountSection, TransferDiscountSection];
  /** 割引を適用する乗車券の種別 */
  ticketTypes: TransferDiscountTicketType[];
  /** 両社の間で経由が必須の事業者 (順番通り) */
  viaOperators?: OperatorId[];
}

/** 合算額から定額を割り引く乗継割引 */
export interface FixedTransferDiscount extends BaseTransferDiscount {
  kind: 'fixed';
  discount: TransferDiscountAmount;
  /** 割引額の置き換え */
  overrides?: TransferDiscountOverride[];
}

/** 東京メトロ・都営地下鉄の連絡特殊割引 (大人は合算額から割引し、小児は割引後の大人運賃から算出) */
export interface CombinedFareTransferDiscount extends BaseTransferDiscount {
  kind: 'combinedFare';
  calculation: {
    /** 大人の割引額 */
    adultDiscount: number;
    child: {
      base: 'discountedAdultFare';
      multiplier: number;
      paperRounding: FareRounding;
      icRounding: FareRounding;
    };
  };
}

/** 乗継割引 */
export type TransferDiscount = FixedTransferDiscount | CombinedFareTransferDiscount;

/** 事業者ごとの乗継割引のデータ (`fare/transfer-discounts.json`) */
export interface TransferDiscountData {
  operator: RailwayId;
  rules: TransferDiscount[];
}
