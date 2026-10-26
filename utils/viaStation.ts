import type { Feature, FeatureCollection, Point } from "geojson";

import type { FareTable, FareType } from "../types/fare.ts";
import type { MapStation, RailMode } from "../types/map.ts";
import type { RailwayId } from "../types/railway.ts";
import type { TransferCandidate } from "../types/via.ts";
import { loadJson, loadOptionalJson } from "./data.ts";

/** 路線の区分ごとの駅のGeoJSON */
export const STATIONS_GEOJSON_URLS: Record<RailMode, string> = {
  jr: "data/jre/map.geojson",
  private: "data/private/map.geojson",
};

/** 路線の区分ごとの運賃表のディレクトリ */
export const FARE_DATA_DIRS: Record<RailMode, string> = {
  jr: "data/jre/fare",
  private: "data/private/fare",
};

/** 乗換候補として表示する、降車駅からの最大の直線距離 (m) */
const TRANSFER_CANDIDATE_RADIUS = 600;

/**
 * 地図に表示する駅のfeatureを読み込む関数
 * - JR線モードでは、改札外乗り換えの乗換駅に使えるように、私鉄線のみの駅も含める
 *   (私鉄線のみの駅には`privateOnly`の印を付け、表示を切り替えられるようにする)
 */
export const loadStationFeatures = async (railMode: RailMode): Promise<Feature[]> => {
  const features = (await loadJson<FeatureCollection>(STATIONS_GEOJSON_URLS[railMode])).features;
  if (railMode === "private") return features;

  // JR線の駅と同じIDの駅(JR線の駅・JR線と同じ改札の駅)は、JR線の駅として表示する
  const jrIds = new Set(features.map((f) => f.properties?.id));
  const privateFeatures = (await loadJson<FeatureCollection>(STATIONS_GEOJSON_URLS.private)).features
    .filter((f) => !jrIds.has(f.properties?.id))
    .map((f) => ({ ...f, properties: { ...f.properties, privateOnly: true } }));
  return [...features, ...privateFeatures];
};

/**
 * 駅の運賃表を取得する関数
 * - 表示中の区分に運賃表が無い駅(私鉄線モードのJR線のみの駅・JR線モードの私鉄線のみの駅)は、
 *   もう一方の区分の運賃表を使う
 * @returns 運賃表 (どちらにも無い場合は`undefined`)
 */
export const fetchFareTable = async (railMode: RailMode, fareType: FareType, stationId: string): Promise<FareTable | undefined> => {
  const tableDir = fareType === "ic" ? "ic-table" : "table";
  const otherMode: RailMode = railMode === "jr" ? "private" : "jr";
  return await loadOptionalJson<FareTable>(`${FARE_DATA_DIRS[railMode]}/${tableDir}/${stationId}.json`)
    ?? loadOptionalJson<FareTable>(`${FARE_DATA_DIRS[otherMode]}/${tableDir}/${stationId}.json`);
};

/** 2点間の直線距離 (m) を求める関数 (ハバーサイン公式) */
const distanceBetween = ([lng1, lat1]: number[], [lng2, lat2]: number[]): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/**
 * GeoJSONのfeatureを地図の駅データに変換する関数
 * - fetchで読み込んだGeoJSONは、配列のプロパティがそのまま配列になっている
 */
const toMapStation = (feature: Feature): MapStation => ({
  id: feature.properties!.id,
  name: feature.properties!.name,
  railways: feature.properties!.railways as RailwayId[] | undefined,
});

/**
 * 降車駅の近くにある乗換候補の駅を探す関数
 * - 物理的には近い(直線距離が一定以内)が、運賃計算上のグラフでは遠い駅を候補とする
 * - グラフ上の遠さは、降車駅の運賃表で「運賃が無い(別の事業者・範囲外)」か「初乗り運賃より高い」ことで判定する
 *   (同じ路線の隣の駅など、改札内で乗り換えられる駅を除外するため)
 * @returns 近い順に並べた乗換候補
 */
export const findTransferCandidates = async (railMode: RailMode, alight: MapStation): Promise<TransferCandidate[]> => {
  const [features, table] = await Promise.all([
    loadStationFeatures(railMode),
    fetchFareTable(railMode, "ticket", alight.id),
  ]);
  const alightFeature = features.find((f) => f.properties?.id === alight.id);
  if (!alightFeature || !table) return [];

  // 降車駅からの初乗り運賃 (運賃表の最安の運賃)
  const fares = Object.entries(table.fares)
    .filter(([id, fare]) => id !== alight.id && fare != null)
    .map(([, fare]) => fare as number);
  const minFare = Math.min(...fares);

  const origin = (alightFeature.geometry as Point).coordinates;
  return features
    .filter((f) => f.properties?.id !== alight.id)
    .map((f) => ({
      station: toMapStation(f),
      distance: distanceBetween(origin, (f.geometry as Point).coordinates),
    }))
    .filter(({ station, distance }) => {
      if (distance > TRANSFER_CANDIDATE_RADIUS) return false;
      const fare = table.fares[station.id];
      return fare == null || fare > minFare;
    })
    .sort((a, b) => a.distance - b.distance);
};
