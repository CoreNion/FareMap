import type { Feature, FeatureCollection, Point } from "geojson";

import type { FareTable, FareType } from "../types/fare.ts";
import type { FareDataMode, MapStation, RailMode } from "../types/map.ts";
import type { RailwayId } from "../types/railway.ts";
import type { TransferCandidate } from "../types/via.ts";
import { loadJson, loadOptionalJson } from "./data.ts";

/** 運賃表のデータがある路線の区分ごとの駅のGeoJSON */
export const STATIONS_GEOJSON_URLS: Record<FareDataMode, string> = {
  jr: "data/jre/map.geojson",
  private: "data/private/map.geojson",
};

/** 運賃表のデータがある路線の区分ごとの運賃表のディレクトリ */
export const FARE_DATA_DIRS: Record<FareDataMode, string> = {
  jr: "data/jre/fare",
  private: "data/private/fare",
};

/** 乗換候補として表示する、降車駅からの最大の直線距離 (m) */
const TRANSFER_CANDIDATE_RADIUS = 600;

/**
 * 地図に表示する駅のfeatureを読み込む関数
 * - 私鉄線モードは、私鉄線の駅とJR線の駅
 * - JR線モード・全線モードは、JR線の駅に私鉄線のみの駅を加える
 *   (JR線モードでは改札外乗り換えの乗換駅に使う。私鉄線のみの駅には`privateOnly`の印を付ける)
 */
export const loadStationFeatures = async (railMode: RailMode): Promise<Feature[]> => {
  if (railMode === "private") return (await loadJson<FeatureCollection>(STATIONS_GEOJSON_URLS.private)).features;
  const features = (await loadJson<FeatureCollection>(STATIONS_GEOJSON_URLS.jr)).features;

  // JR線の駅と同じIDの駅(JR線の駅・JR線と同じ改札の駅)は、JR線の駅として表示する
  const jrIds = new Set(features.map((f) => f.properties?.id));
  const privateFeatures = (await loadJson<FeatureCollection>(STATIONS_GEOJSON_URLS.private)).features
    .filter((f) => !jrIds.has(f.properties?.id))
    .map((f) => ({ ...f, properties: { ...f.properties, privateOnly: true } }));
  return [...features, ...privateFeatures];
};

/** 運賃表のデータがある区分の運賃表を読み込む関数 */
const loadFareTable = (mode: FareDataMode, fareType: FareType, stationId: string): Promise<FareTable | undefined> => {
  const tableDir = fareType === "ic" ? "ic-table" : "table";
  return loadOptionalJson<FareTable>(`${FARE_DATA_DIRS[mode]}/${tableDir}/${stationId}.json`);
};

/**
 * JR線と私鉄線の運賃表を、着駅ごとに安い方の運賃でまとめる関数 (全線モード用)
 * - 経由する事業者(`via`)は、採用した運賃表のものを使う
 */
const mergeFareTables = (jr: FareTable, priv: FareTable): FareTable => {
  const fares: FareTable["fares"] = {};
  const via: NonNullable<FareTable["via"]> = {};
  for (const id of new Set([...Object.keys(jr.fares), ...Object.keys(priv.fares)])) {
    const jrFare = jr.fares[id];
    const privateFare = priv.fares[id];
    const usePrivate = privateFare != null && (jrFare == null || privateFare < jrFare);
    const table = usePrivate ? priv : jr;
    fares[id] = usePrivate ? privateFare : jrFare ?? null;
    if (table.via?.[id]) via[id] = table.via[id];
  }
  return { id: jr.id, name: jr.name, fares, via };
};

/**
 * 駅の運賃表を取得する関数
 * - 表示中の区分に運賃表が無い駅(私鉄線モードのJR線のみの駅・JR線モードの私鉄線のみの駅)は、
 *   もう一方の区分の運賃表を使う
 * - 全線モードでは、両方の運賃表がある駅(JR線と同じ改札の駅)は安い方の運賃にまとめる
 * @returns 運賃表 (どちらにも無い場合は`undefined`)
 */
export const fetchFareTable = async (railMode: RailMode, fareType: FareType, stationId: string): Promise<FareTable | undefined> => {
  if (railMode === "all") {
    const [jr, priv] = await Promise.all([
      loadFareTable("jr", fareType, stationId),
      loadFareTable("private", fareType, stationId),
    ]);
    return jr && priv ? mergeFareTables(jr, priv) : jr ?? priv;
  }
  const otherMode: FareDataMode = railMode === "jr" ? "private" : "jr";
  return await loadFareTable(railMode, fareType, stationId) ?? loadFareTable(otherMode, fareType, stationId);
};

/** 2点間の直線距離 (m) を求める関数 (ハバーサイン公式) */
export const distanceBetween = ([lng1, lat1]: number[], [lng2, lat2]: number[]): number => {
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
