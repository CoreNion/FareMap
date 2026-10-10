/** 対応している鉄道事業者のコード */
export type SUPPORTED_RAILWAY = 'jre' | 'toei';

/** 鉄道事業者の表示情報 */
export interface RailwayInfo {
  id: SUPPORTED_RAILWAY;
  /** 事業者名 (切替ボタンなどに表示) */
  name: string;
  /** 駅名の前に付ける接頭辞 (例: "JR", "都営") */
  prefix: string;
  /** 運賃の適用範囲の説明 (例: "JR東日本線経由") */
  note: string;
}
