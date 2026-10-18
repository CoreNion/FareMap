import fs from 'fs/promises';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';

import type { FareTable, FareType } from '../types/fare.ts';
import type { Graph } from '../types/graph.ts';
import type { RailMode } from '../types/map.ts';
import { calculateFare, getJrDistance } from './calc.ts';
import { calculateIcFare, calculateRouteFare } from './icRoute.ts';
import { PRIVATE_RAILWAYS } from './railway.ts';

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');
const DEFAULT_GRAPH_PATH = path.join(DATA_DIR, 'jre', 'fare', 'graph.json');
/** 路線の区分・運賃の種別ごとの運賃表の出力先 */
const DEFAULT_OUT_DIRS: Record<RailMode, Record<FareType, string>> = {
  jr: {
    ticket: path.join(DATA_DIR, 'jre', 'fare', 'table'),
    ic: path.join(DATA_DIR, 'jre', 'fare', 'ic-table'),
  },
  private: {
    ticket: path.join(DATA_DIR, 'private', 'fare', 'table'),
    ic: path.join(DATA_DIR, 'private', 'fare', 'ic-table'),
  },
};

/** 私鉄線モードで、私鉄の駅からJR線のみの駅への運賃を表示するJR線区間の営業キロの上限 (0.1km単位) */
const PRIVATE_TO_JR_MAX_DISTANCE = 1000;

/** 運賃表の計算対象の駅 */
interface FareTableStations {
  /** 発駅となる駅のID */
  originIds: string[];
  /** 着駅となる駅 (駅ID -> 駅) */
  stations: Graph['stations'];
  /** JR線のみの駅のID (私鉄線モードのみ) */
  jrOnlyIds: string[];
}

const readJson = async <T>(p: string): Promise<T> => {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt) as T;
};

/**
 * 路線の区分に応じて、運賃表の計算対象の駅を読み込む関数
 * - JR線モード: JR線の全駅
 * - 私鉄線モード: 発駅は私鉄各社の全駅、着駅は私鉄各社とJR線の全駅
 */
const loadFareTableStations = async (mode: RailMode, graphPath: string): Promise<FareTableStations> => {
  const jrGraph = await readJson<Graph>(graphPath);
  if (mode === 'jr') {
    return { originIds: Object.keys(jrGraph.stations), stations: jrGraph.stations, jrOnlyIds: [] };
  }

  const privateStations: Graph['stations'] = {};
  for (const railway of PRIVATE_RAILWAYS) {
    const graph = await readJson<Graph>(path.join(DATA_DIR, railway, 'fare', 'graph.json'));
    for (const [id, st] of Object.entries(graph.stations)) {
      privateStations[id] ??= st;
    }
  }
  const jrOnlyIds = Object.keys(jrGraph.stations).filter((id) => !privateStations[id]);
  return {
    originIds: Object.keys(privateStations),
    stations: { ...jrGraph.stations, ...privateStations },
    jrOnlyIds,
  };
};

/**
 * 私鉄線モードで、指定した駅から全駅への運賃を計算し、運賃テーブルを生成する
 * - JR線経由を含む最安経路で計算し、他社線をまたぐ駅の事業者の並びを`via`に記録する
 * - JR線のみの駅は、経路のJR線区間の営業キロが上限以内の場合のみ運賃表に含める
 */
const generatePrivateFareTableForStation = async (
  targets: FareTableStations,
  stationID: string,
  type: FareType,
): Promise<FareTable> => {
  const st = targets.stations[stationID];
  if (!st) throw new Error('駅が存在しません: ' + stationID);
  const fares: FareTable['fares'] = {};
  const via: NonNullable<FareTable['via']> = {};
  const jrOnlyIds = new Set(targets.jrOnlyIds);

  for (const toId of Object.keys(targets.stations)) {
    try {
      const { fare, segments } = await calculateRouteFare(stationID, toId, type);

      if (jrOnlyIds.has(toId)) {
        // JR線区間の営業キロの合計が上限を超える駅は表示しない
        let jrDistance = 0;
        for (const s of segments.filter((s) => s.railway === 'jre')) {
          jrDistance += await getJrDistance(s.from, s.to);
        }
        if (jrDistance > PRIVATE_TO_JR_MAX_DISTANCE) continue;
      }

      fares[toId] = fare;
      if (segments.length > 1) {
        via[toId] = segments.map((s) => s.railway);
      }
    } catch {
      // JR線のみの駅は営業キロを判定できないため表示しない
      if (jrOnlyIds.has(toId)) continue;
      fares[toId] = null;
    }
  }

  return { id: stationID, name: st.name, fares, via };
};

/**
 * 指定した駅からグラフ内にある全駅への運賃を計算し、運賃テーブルを生成する
 * - IC運賃の場合は、JR線のみではない経路で算出した駅の事業者の並びを`via`に記録する
 * @param targets 運賃表の計算対象の駅
 * @param stationID
 * @param type 運賃の種別
 * @param mode 路線の区分
 * @returns
 */
export const generateFareTableForStation = async (
  targets: FareTableStations,
  stationID: string,
  type: FareType = 'ticket',
  mode: RailMode = 'jr',
): Promise<FareTable> => {
  if (mode === 'private') return generatePrivateFareTableForStation(targets, stationID, type);

  const st = targets.stations[stationID];
  if (!st) throw new Error('駅が存在しません: ' + stationID);
  const fares: FareTable['fares'] = {};
  const via: NonNullable<FareTable['via']> = {};

  // グラフ内の全駅に対して運賃を計算する
  for (const toId of Object.keys(targets.stations)) {
    const toSt = targets.stations[toId];
    try {
      if (type === 'ic') {
        const { fare, segments } = await calculateIcFare(stationID, toId);
        fares[toId] = fare;
        if (segments.some((s) => s.railway !== 'jre')) {
          via[toId] = segments.map((s) => s.railway);
        }
      } else {
        fares[toId] = await calculateFare(st, toSt, type);
      }
    } catch (err) {
      console.warn(`計算エラー: ${stationID} -> ${toId}:`, err);
      fares[toId] = null;
    }
  }

  return type === 'ic'
    ? { id: stationID, name: st.name, fares, via }
    : { id: stationID, name: st.name, fares };
};

/**
 * 全駅に対して運賃テーブルを生成し、各駅ごとにJSONファイルとして出力する
 * @param options
 * @returns
 */
export const generateAndWriteAllFareTables = async (options?: {
  graphPath?: string;
  farePath?: string;
  outDir?: string;
  type?: FareType;
  mode?: RailMode;
}) => {
  const graphPath = options?.graphPath ?? DEFAULT_GRAPH_PATH;
  const type = options?.type ?? 'ticket';
  const mode = options?.mode ?? 'jr';
  const outDir = options?.outDir ?? DEFAULT_OUT_DIRS[mode][type];

  const targets = await loadFareTableStations(mode, graphPath);
  const stationIds = targets.originIds;

  await fs.mkdir(outDir, { recursive: true });

  // 他の作業を妨げないように、ワーカー数は全コアの8割までとする
  const maxWorkers = Math.max(1, Math.floor(cpus().length * 0.8));
  const numWorkers = Math.min(maxWorkers, stationIds.length);
  const batchSize = Math.ceil(stationIds.length / numWorkers);
  const batches: string[][] = [];

  for (let i = 0; i < stationIds.length; i += batchSize) {
    batches.push(stationIds.slice(i, i + batchSize));
  }

  let completedCount = 0;
  const promises = batches.map((batch, index) => {
    return new Promise<void>((resolve, reject) => {
      // tsx を使用して実行している場合、Worker にも tsx を通す必要がある
      // process.execArgv を引き継ぐことで、tsx の環境を維持する
      const worker = new Worker(__filename, {
        workerData: {
          targets,
          stationIds: batch,
          outDir,
          type,
          mode,
          workerId: index
        },
        execArgv: process.execArgv
      });

      worker.on('message', (message) => {
        if (message.type === 'progress') {
          completedCount++;
          if (completedCount % 10 === 0 || completedCount === stationIds.length) {
            console.log(`Progress: ${completedCount}/${stationIds.length} (${((completedCount / stationIds.length) * 100).toFixed(1)}%)`);
          }
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`ワーカーが異常終了しました... ${code}`));
        } else {
          resolve();
        }
      });
    });
  });

  await Promise.all(promises);

  return { outDir, count: stationIds.length };
};

// Worker logic
if (!isMainThread) {
  const { targets, stationIds, outDir, type, mode } = workerData;

  (async () => {
    for (const id of stationIds) {
      const table = await generateFareTableForStation(targets, id, type, mode);
      const fp = path.join(outDir, `${id}.json`);
      await fs.writeFile(fp, JSON.stringify(table, null, 2), 'utf8');
      parentPort?.postMessage({ type: 'progress', id });
    }
    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// CLI
// `--ic` を指定するとIC運賃の運賃表を生成する (例: `yarn generate-faretable --ic`)
// `--private` を指定すると私鉄線モードの運賃表を生成する (例: `yarn generate-faretable --private --ic`)
if (isMainThread && require.main === module) {
  (async () => {
    try {
      const startTime = Date.now();
      const type: FareType = process.argv.includes('--ic') ? 'ic' : 'ticket';
      const mode: RailMode = process.argv.includes('--private') ? 'private' : 'jr';
      const r = await generateAndWriteAllFareTables({ type, mode });
      const endTime = Date.now();
      console.log('全駅の処理が完了しました。総数=', r.count);
      console.log(`Time taken: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    } catch (err) {
      console.error('エラーが発生しました...\n', err);
      process.exit(1);
    }
  })();
}
