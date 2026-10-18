export interface MapStation {
  id: string;
  name: string;
}
/** 地図に表示する路線の区分 (jr: JR線, private: 私鉄線) */
export type RailMode = 'jr' | 'private';
