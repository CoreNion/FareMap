import fs from 'fs/promises';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';

import type { FareTable, FareType } from '../types/fare.ts';
import type { Graph } from '../types/graph.ts';
import { calculateFare } from './calc.ts';
import { calculateIcFare } from './icRoute.ts';

const DEFAULT_GRAPH_PATH = path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'graph.json');
/** 運賃の種別ごとの運賃表の出力先 */
const DEFAULT_OUT_DIRS: Record<FareType, string> = {
  ticket: path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'table'),
  ic: path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'ic-table'),
};

const readJson = async <T>(p: string): Promise<T> => {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt) as T;
};

/**
 * 指定した駅からグラフ内にある全駅への運賃を計算し、運賃テーブルを生成する
 * - IC運賃の場合は、JR線のみではない経路で算出した駅の事業者の並びを`via`に記録する
 * @param graph 
 * @param stationID 
 * @param type 運賃の種別
 * @returns 
 */
export const generateFareTableForStation = async (
  graph: Graph,
  stationID: string,
  type: FareType = 'ticket'
): Promise<FareTable> => {
  const st = graph.stations[stationID];
  if (!st) throw new Error('駅が存在しません: ' + stationID);
  const fares: FareTable['fares'] = {};
  const via: NonNullable<FareTable['via']> = {};

  // グラフ内の全駅に対して運賃を計算する
  for (const toId of Object.keys(graph.stations)) {
    const toSt = graph.stations[toId];
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
 * グラフ内の全駅に対して運賃テーブルを生成し、各駅ごとにJSONファイルとして出力する
 * @param options 
 * @returns 
 */
export const generateAndWriteAllFareTables = async (options?: {
  graphPath?: string;
  farePath?: string;
  outDir?: string;
  type?: FareType;
}) => {
  const graphPath = options?.graphPath ?? DEFAULT_GRAPH_PATH;
  const type = options?.type ?? 'ticket';
  const outDir = options?.outDir ?? DEFAULT_OUT_DIRS[type];

  const graph = await readJson<Graph>(graphPath);
  const stationIds = Object.keys(graph.stations);

  await fs.mkdir(outDir, { recursive: true });

  const numWorkers = Math.min(cpus().length, stationIds.length);
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
          graph,
          stationIds: batch,
          outDir,
          type,
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
  const { graph, stationIds, outDir, type } = workerData;

  (async () => {
    for (const id of stationIds) {
      const table = await generateFareTableForStation(graph, id, type);
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
if (isMainThread && require.main === module) {
  (async () => {
    try {
      const startTime = Date.now();
      const type: FareType = process.argv.includes('--ic') ? 'ic' : 'ticket';
      const r = await generateAndWriteAllFareTables({ type });
      const endTime = Date.now();
      console.log('全駅の処理が完了しました。総数=', r.count);
      console.log(`Time taken: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    } catch (err) {
      console.error('エラーが発生しました...\n', err);
      process.exit(1);
    }
  })();
}
