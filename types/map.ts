import type { RailwayId } from "./railway.ts";

export interface MapStation {
  id: string;
  name: string;
  /** 駅を含む事業者の一覧 (私鉄線モードのみ) */
  railways?: RailwayId[];
}

/** 運賃表のデータがある路線の区分 (jr: JR線, private: 私鉄線) */
export type FareDataMode = 'jr' | 'private';

/** 地図に表示する路線の区分 (jr: JR線, private: 私鉄線, all: 全線) */
export type RailMode = FareDataMode | 'all';
