import type { RailwayInfo, SUPPORTED_RAILWAY } from "../types/railway.ts";

/** 対応している鉄道事業者の一覧 */
export const RAILWAYS: Record<SUPPORTED_RAILWAY, RailwayInfo> = {
  jre: {
    id: 'jre',
    name: 'JR東日本',
    prefix: 'JR',
    note: 'JR東日本線経由',
  },
  toei: {
    id: 'toei',
    name: '都営地下鉄',
    prefix: '都営',
    note: '都営地下鉄線内',
  },
};

/**
 * 文字列が対応している鉄道事業者コードかどうかを判定する
 * @param value 判定する文字列
 */
export const isSupportedRailway = (value: unknown): value is SUPPORTED_RAILWAY =>
  typeof value === 'string' && Object.hasOwn(RAILWAYS, value);
