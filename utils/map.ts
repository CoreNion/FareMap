import fs from 'fs/promises';
import path from 'path';
import type { Graph } from '../types/graph.ts';
import type { FareLines } from '../types/fare.ts';
import type { RailwayId } from '../types/railway.ts';
import { PRIVATE_RAILWAYS, RAILWAYS, RAILWAY_COLORS, RAILWAY_SHORT_NAMES } from './railway.ts';

import type { Feature, FeatureCollection } from 'geojson';

// 表示優先度の高い主要駅のIDリスト
const TOP_TERMINAL_ID = [
  "tokyo", "shimbashi", "shinagawa", "akihabara", "ueno", "osaki","shibuya", "shinjuku", "ikebukuro",
  "kawasaki", "yokohama", "odawara", "atami", "kamakura",
  "tachikawa", "hachioji", "kofu",
  "shinyokohama", "musashikosugi",
  "omiya", "utsunomiya", "takasaki",
  "kitasenju", "tsuchiura", "mito",
  "narita-airport-t1", "chiba",
  "maihama", "kaihinmakuhari",
  // 私鉄線
  "shibuya_subway_tokyu", "shinjuku_metro", "ikebukuro_subway", "otemachi_metro", "ginza", "ueno_subway", "omotesando",
  "shinjuku_odakyu", "shinjuku_toei_keio", "seibushinjuku", "ikebukuro_seibu", "shibuya_keio",
  "yokohama_tokyu_mm", "yokohama_sotetsu", "yokohama_keikyu", "shinagawa_keikyu", "sengakuji", "oshiage_toei_keisei",
  "haneda_airport_terminal1_2", "odawara_odakyu", "hakoneyumoto"
]
// 表示優先度の高い駅のIDリスト
const TERMINAL_IDs = [
  "ofuna", "chigasaki", "kodu", "itou", "kurihama",
  "kokubunji", "mitaka", "takao", "otsuki",
  "haijima", "ome", "musashiitsukaichi", "okutama", "komagawa",
  "hashimoto", "ebina", "machida", "nagatsuda", 
  "musashimizonokuchi", "noborito", "inadazutsumi", "fuchuhonmachi",
  "kuki", "oyama", "utsunomiya", "kumagaya", "takasaki", "maebashi",
  "musashiurawa", "kawagoe",
  "abiko", "kashiwa", "ushiku", "ishioka",
  "sakura", "naruto", "kisarazu", "kazusaichinomiya",
  "ichikawa",
  "shinkiba", "nishifunabashi", "soga",
  // 私鉄線
  "kitasenju", "nakano", "wakoshi", "yoyogiuehara", "nakameguro", "meguro_subway_tokyu", "shirokanetakanawa", "kudanshita",
  "futakotamagawa", "mizonokuchi", "azamino", "chuorinkan_tokyu", "jiyugaoka", "musashikosugi_tokyu", "shinyokohama_tokyu_sotetsu",
  "ebina_sotetsu", "shonandai_sotetsu", "keikyukamata", "kamiooka_keikyu", "misakiguchi",
  "meidaimae", "chofu", "keiohachioji", "hashimoto_keio", "takaosanguchi",
  "shinyurigaoka", "machida_odakyu", "sagamiono", "fujisawa_odakyu", "kataseenoshima",
  "tokorozawa", "hanno", "honkawagoe", "nerima", "takadanobaba_seibu",
  "shinyokohama_yokohama-city", "totsuka_yokohama-city", "urawamisono", "toyokatsutadai", "nishimagome", "tochomae"
]

/**
 * 駅名の表記揺れ(ヶ/ケ、半角の中黒など)をそろえる関数
 */
const normalizeStationName = (name: string): string =>
  name.replace(/[ヶヵ]/g, 'ケ').replace(/[･]/g, '・');

/**
 * GeoJSON(鉄道駅LOD GeoJSON)を運賃マップで使うデータに加工する
 * - geometry.typeがPoint以外のfeatureは削除し、駅データのみを残す
 * - 全てのfeatureのuriプロパティを削除
 * - feature.properties.nameとgraph.stationsのnameを照合して、対応するstation.idをfeature.properties.idに追加
 * 
 * @param geojson 変換前のGeoJSON (FeatureCollection)
 * @param graph 駅情報のグラフデータ
 * @param lineStations 優先して照合する路線の駅 (同じ駅名の駅が複数ある事業者で、地図の路線の駅に絞り込むために使う)
 * @returns 変換後のGeoJSON
 */
export const transformGeoJSON = (geojson: FeatureCollection, graph: Graph, lineStations: { id: string, name: string }[] = []) => {
  if (!geojson || !geojson.features) return geojson;

  // 路線の駅を先に並べ、駅名が同じ場合は路線の駅を優先する
  const stations = [...lineStations, ...Object.values(graph.stations)];
  const findStation = (name: string) => stations.find(s => normalizeStationName(s.name) === normalizeStationName(name));

  const transformedFeatures = geojson.features
    .filter((feature: Feature) => {
      if (feature.geometry?.type === 'Point' && feature.properties?.name) {
        // 運賃マップに存在しない駅は削除
        const station = findStation(feature.properties.name);
        return !!station;
      } else {
        // 駅Point以外のfeatureは削除
        return false;
      }
    }).map((feature: Feature) => {
      if (feature.properties) {
        // 全てのfeatureのuriプロパティを削除
        delete feature.properties.uri;

        // 対応するstation.idを追加
        const station = findStation(feature.properties.name);
        feature.properties.id = station!.id;

        // 表示優先度を追加
        const stId = station!.id;
        feature.properties.sortKey = TOP_TERMINAL_ID.includes(stId) ? 2 : (TERMINAL_IDs.includes(stId) ? 3 : 4);
      }

      return feature;
    });

  return {
    ...geojson,
    features: transformedFeatures
  };
}

/**
 * 指定ディレクトリのGeoJSONファイルをすべて変換し、一つのGeoJSONファイルとして保存する関数
 * 
 * @param mapDir GeoJSONファイルが格納されているディレクトリ
 * @param graphPath graph.jsonのパス
 * @param outputPath 変換後のGeoJSONを保存するパス
 */
export const processGeoJSONFiles = async (mapDir: string, graphPath: string, outputPath: string) => {
  const graphContent = await fs.readFile(graphPath, 'utf8');
  const graph: Graph = JSON.parse(graphContent);

  const files = await fs.readdir(mapDir);
  const geojsonFiles = files.filter(f => f.endsWith('.geojson'));

  let allFeatures: Feature[] = [];

  for (const file of geojsonFiles) {
    const filePath = path.join(mapDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const geojson = JSON.parse(content);

    const transformed = transformGeoJSON(geojson, graph);
    allFeatures = allFeatures.concat(transformed.features);
  }

  // 重複するfeatureを削除（idが同じものは一つだけ残す）
  const uniqueAllFeatures = allFeatures.filter((feature, index, self) =>
    index === self.findIndex(f => f.properties?.id === feature.properties?.id)
  );

  const outputGeoJSON = {
    type: "FeatureCollection",
    features: uniqueAllFeatures
  };

  await fs.writeFile(outputPath, JSON.stringify(outputGeoJSON, null, 2), 'utf8');
}

/** 地図の路線ファイル名と、運賃計算用の路線ファイル名が異なるもの */
const MAP_LINE_ALIASES: Record<string, string> = {
  nanboku: 'namboku',
  'marunouchi-honancho': 'marunouchi',
};

/**
 * 事業者の地図データ(GeoJSON)のファイル一覧を取得する関数
 * - `{id}/map/*.geojson` が無い事業者は、`{id}/*.geojson` を使う (生成物の`map.geojson`は除く)
 */
const listRailwayMapFiles = async (railwayDir: string): Promise<string[]> => {
  const mapDir = path.join(railwayDir, 'map');
  const hasMapDir = await fs.stat(mapDir).then((st) => st.isDirectory()).catch(() => false);
  const dir = hasMapDir ? mapDir : railwayDir;
  const files = await fs.readdir(dir);
  return files
    .filter((f) => f.endsWith('.geojson') && f !== 'map.geojson')
    .map((f) => path.join(dir, f));
}

/**
 * 地図の路線ファイルに対応する、運賃計算用の路線の駅一覧を読み込む関数
 * @returns 路線の駅一覧 (対応する路線ファイルが無い場合は空配列)
 */
const loadLineStations = async (railwayDir: string, mapFile: string) => {
  const base = path.basename(mapFile, '.geojson');
  const lineName = MAP_LINE_ALIASES[base] ?? base;
  try {
    const txt = await fs.readFile(path.join(railwayDir, 'fare', 'lines', `${lineName}.json`), 'utf8');
    const json = JSON.parse(txt) as { lines: FareLines['lines'] };
    return json.lines.flatMap((line) => line.stations);
  } catch {
    return [];
  }
}

/**
 * 私鉄線モード用に、私鉄各社とJR線の駅を一つのGeoJSONファイルにまとめて保存する関数
 * - 私鉄の駅は各社の地図データを各社のグラフで変換し、駅IDで重複を除く
 * - JR線の駅は`jre/map.geojson`から追加する (私鉄の駅と同じIDの駅は除く)
 * - 各featureに、駅を含む事業者の一覧(`railways`)を追加する
 *
 * @param dataDir `public/data` のパス
 * @param outputPath 変換後のGeoJSONを保存するパス
 */
export const processPrivateGeoJSONFiles = async (dataDir: string, outputPath: string) => {
  // 駅ID -> 駅を含む事業者の一覧
  const stationRailways = new Map<string, RailwayId[]>();
  const graphs = new Map<RailwayId, Graph>();
  for (const railway of RAILWAYS) {
    const graph: Graph = JSON.parse(await fs.readFile(path.join(dataDir, railway, 'fare', 'graph.json'), 'utf8'));
    graphs.set(railway, graph);
    for (const id of Object.keys(graph.stations)) {
      stationRailways.set(id, [...(stationRailways.get(id) ?? []), railway]);
    }
  }

  let allFeatures: Feature[] = [];
  for (const railway of PRIVATE_RAILWAYS) {
    const railwayDir = path.join(dataDir, railway);
    for (const file of await listRailwayMapFiles(railwayDir)) {
      const geojson = JSON.parse(await fs.readFile(file, 'utf8'));
      const lineStations = await loadLineStations(railwayDir, file);
      const transformed = transformGeoJSON(geojson, graphs.get(railway)!, lineStations);
      allFeatures = allFeatures.concat(transformed.features);
    }
  }

  // JR線の駅を追加する
  const jrGeoJSON: FeatureCollection = JSON.parse(await fs.readFile(path.join(dataDir, 'jre', 'map.geojson'), 'utf8'));
  allFeatures = allFeatures.concat(jrGeoJSON.features);

  // 重複するfeatureを削除（idが同じものは一つだけ残す）
  const seenIds = new Set<string>();
  const uniqueAllFeatures = allFeatures
    .filter((feature) => {
      const id = feature.properties?.id;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .map((feature) => {
      const railways = stationRailways.get(feature.properties!.id) ?? [];
      return {
        ...feature,
        properties: {
          ...feature.properties,
          name: feature.properties!.name as string,
          railways,
          // 駅アイコンの色に使う事業者 (私鉄の駅は最初の私鉄、JR線のみの駅はJR線)
          railway: railways.find((r) => r !== 'jre') ?? 'jre',
        },
      };
    });

  // 同じ駅名で改札(駅ID)が異なる駅は、駅名の前に対象の事業者を付ける (例: [JR]渋谷、[京王]渋谷)
  const nameCounts = new Map<string, number>();
  for (const feature of uniqueAllFeatures) {
    const name = normalizeStationName(feature.properties.name);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  for (const feature of uniqueAllFeatures) {
    if (nameCounts.get(normalizeStationName(feature.properties.name))! < 2) continue;
    const operators = feature.properties.railways.map((r) => RAILWAY_SHORT_NAMES[r]).join('・');
    feature.properties.name = `[${operators}]${feature.properties.name}`;
  }

  const outputGeoJSON = {
    type: "FeatureCollection",
    features: uniqueAllFeatures
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(outputGeoJSON, null, 2), 'utf8');
}

/** 路線の線のGeoJSONで、座標を丸める桁数 (約10m単位) */
const LINE_COORD_DIGITS = 4;

/**
 * 全事業者の地図データから路線の線(LineString)を取り出し、一つのGeoJSONファイルとして保存する関数
 * - 各featureには、路線の色(`color`)と事業者(`railway`)のみを残す
 * - 色が無い路線は事業者の色を使う
 * - ファイルサイズを抑えるため、座標を丸めて改行無しで出力する
 *
 * @param dataDir `public/data` のパス
 * @param outputPath 変換後のGeoJSONを保存するパス
 */
export const processLineGeoJSONFiles = async (dataDir: string, outputPath: string) => {
  const round = (v: number) => Number(v.toFixed(LINE_COORD_DIGITS));
  const features: Feature[] = [];

  for (const railway of RAILWAYS) {
    for (const file of await listRailwayMapFiles(path.join(dataDir, railway))) {
      const geojson: FeatureCollection = JSON.parse(await fs.readFile(file, 'utf8'));
      for (const feature of geojson.features) {
        const geometry = feature.geometry;
        if (geometry?.type !== 'LineString' && geometry?.type !== 'MultiLineString') continue;

        const color = feature.properties?.color ? `#${feature.properties.color}` : RAILWAY_COLORS[railway];
        const coordinates = geometry.type === 'LineString'
          ? geometry.coordinates.map((c) => c.map(round))
          : geometry.coordinates.map((line) => line.map((c) => c.map(round)));
        features.push({
          type: 'Feature',
          properties: { color, railway },
          geometry: { type: geometry.type, coordinates } as Feature['geometry'],
        });
      }
    }
  }

  await fs.writeFile(outputPath, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8');
}

// CLI
// `--private` を指定すると私鉄線モード用のGeoJSONを生成する
// `--lines` を指定すると全事業者の路線の線のGeoJSONを生成する (例: `yarn generate-geojson --lines`) (例: `yarn generate-geojson --private`)
if (require.main === module) {
  (async () => {
    try {
      const dataDir = path.resolve(process.cwd(), 'public', 'data');

      console.log('変換開始...');
      if (process.argv.includes('--lines')) {
        await processLineGeoJSONFiles(dataDir, path.join(dataDir, 'lines.geojson'));
      } else if (process.argv.includes('--private')) {
        await processPrivateGeoJSONFiles(dataDir, path.join(dataDir, 'private', 'map.geojson'));
      } else {
        await processGeoJSONFiles(
          path.join(dataDir, 'jre', 'map'),
          path.join(dataDir, 'jre', 'fare', 'graph.json'),
          path.join(dataDir, 'jre', 'map.geojson'),
        );
      }
      console.log('変換が完了しました');
    } catch (err) {
      console.error('変換中にエラーが発生しました...', err);
      process.exit(1);
    }
  })();
}
