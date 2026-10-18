export type SUPPORTED_RAILWAY = 'jre';

/** 運賃データがある鉄道事業者のID (`public/data/{id}` に対応) */
export type RailwayId = 'jre'
  | 'metro' | 'toei' | 'tokyu' | 'sotetsu'
  | 'keikyu' | 'keio' | 'odakyu' | 'seibu'
  | 'yokohama-kosoku' | 'yokohama-city' | 'hakone'
  | 'saitama-kosoku' | 'toyo-kosoku';

/** JR以外(私鉄・地下鉄)の事業者ID */
export type PrivateRailwayId = Exclude<RailwayId, 'jre'>;

/**
 * 乗継割引のデータに出てくる事業者のID
 * - 運賃データがある事業者に加え、運賃データが未収録の事業者を含む
 * - 埼玉高速鉄道・東葉高速鉄道は、データのディレクトリ名と異なるID(`saitama`・`toyo`)で収録されている
 */
export type OperatorId = Exclude<RailwayId, 'saitama-kosoku' | 'toyo-kosoku'>
  | 'tobu' | 'keisei' | 'hokuso' | 'toyo' | 'saitama';
