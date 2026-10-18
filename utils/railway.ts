import type { OperatorId, PrivateRailwayId, RailwayId } from "../types/railway.ts";

/** JR以外(私鉄・地下鉄)の事業者一覧 */
export const PRIVATE_RAILWAYS: PrivateRailwayId[] = [
  'metro', 'toei', 'tokyu', 'sotetsu',
  'keikyu', 'keio', 'odakyu', 'seibu',
  'yokohama-kosoku', 'yokohama-city', 'hakone',
  'saitama-kosoku', 'toyo-kosoku',
];

/** 全事業者の一覧 */
export const RAILWAYS: RailwayId[] = ['jre', ...PRIVATE_RAILWAYS];

/** 事業者ごとの表示名 */
export const RAILWAY_NAMES: Record<RailwayId, string> = {
  jre: 'JR東日本線',
  metro: '東京メトロ線',
  toei: '都営地下鉄線',
  tokyu: '東急線',
  sotetsu: '相鉄線',
  keikyu: '京急線',
  keio: '京王線',
  odakyu: '小田急線',
  seibu: '西武線',
  'yokohama-kosoku': 'みなとみらい線',
  'yokohama-city': '横浜市営地下鉄線',
  hakone: '箱根登山電車線',
  'saitama-kosoku': '埼玉高速鉄道線',
  'toyo-kosoku': '東葉高速線',
};

/** 乗継割引のデータの事業者IDのうち、運賃データの事業者IDと異なるもの */
const OPERATOR_RAILWAY_IDS: Partial<Record<OperatorId, RailwayId>> = {
  saitama: 'saitama-kosoku',
  toyo: 'toyo-kosoku',
};

/** 乗継割引のデータの事業者IDを、運賃データの事業者IDに変換する */
export const toRailwayId = (operator: OperatorId): string => OPERATOR_RAILWAY_IDS[operator] ?? operator;
