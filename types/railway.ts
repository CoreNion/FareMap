export type SUPPORTED_RAILWAY = 'jre';

/** 運賃データがある鉄道事業者のID (`public/data/{id}` に対応) */
export type RailwayId = 'jre' | 'metro' | 'toei' | 'tokyu' | 'sotetsu';

/** JR以外(私鉄・地下鉄)の事業者ID */
export type PrivateRailwayId = Exclude<RailwayId, 'jre'>;
