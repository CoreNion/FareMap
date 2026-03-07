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
  lines: {
    id: string;
    chihou: boolean;
    stations: FareStation[];
  }[];
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
    [destinationId: string]: number;
  }
}