export type SUPPORTED_RAILWAY = 'jre';

/** 運賃データがある鉄道事業者のID (`public/data/{id}` に対応) */
export type RailwayId = 'jre' | 'metro' | 'toei' | 'tokyu' | 'sotetsu';

/** JR以外(私鉄・地下鉄)の事業者ID */
export type PrivateRailwayId = Exclude<RailwayId, 'jre'>;

/**
 * 乗継割引のデータに出てくる事業者のID
 * - 運賃データがある事業者に加え、運賃データが未収録の事業者を含む
 */
export type OperatorId = RailwayId
  | 'keio' | 'keikyu' | 'odakyu' | 'tobu' | 'seibu' | 'keisei'
  | 'hokuso' | 'toyo' | 'saitama' | 'yokohama-minatomirai';
