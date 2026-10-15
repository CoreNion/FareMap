import type { PrivateRailwayId, RailwayId } from "../types/railway.ts";

/** JR以外(私鉄・地下鉄)の事業者一覧 */
export const PRIVATE_RAILWAYS: PrivateRailwayId[] = ['metro', 'toei', 'tokyu', 'sotetsu'];

/** 全事業者の一覧 */
export const RAILWAYS: RailwayId[] = ['jre', ...PRIVATE_RAILWAYS];

/** 事業者ごとの表示名 */
export const RAILWAY_NAMES: Record<RailwayId, string> = {
  jre: 'JR東日本線',
  metro: '東京メトロ線',
  toei: '都営地下鉄線',
  tokyu: '東急線',
  sotetsu: '相鉄線',
};
