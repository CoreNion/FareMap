import fs from 'fs/promises';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';

import type { Graph } from '../types/graph.ts';
import { calculateFare } from './calc.ts';

const DEFAULT_GRAPH_PATH = path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'graph.json');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'table');

const readJson = async <T>(p: string): Promise<T> => {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt) as T;
};

/**
 * 指定した駅からグラフ内にある全駅への運賃を計算し、運賃テーブルを生成する
 * @param graph 
 * @param stationID 
 * @returns 
 */
export const generateFareTableForStation = async (
  graph: Graph,
  stationID: string
): Promise<{ id: string; name: string; fares: Record<string, number | null> }> => {
  const st = graph.stations[stationID];
  if (!st) throw new Error('駅が存在しません: ' + stationID);
  const fares: Record<string, number | null> = {};

  // グラフ内の全駅に対して運賃を計算する
  for (const toId of Object.keys(graph.stations)) {
    const toSt = graph.stations[toId];
    try {
      const f = await calculateFare(st, toSt);
      fares[toId] = f;
    } catch (err) {
      console.warn(`計算エラー: ${stationID} -> ${toId}:`, err);
      fares[toId] = null;
    }
  }

  return { id: stationID, name: st.name, fares };
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
}) => {
  const graphPath = options?.graphPath ?? DEFAULT_GRAPH_PATH;
  const outDir = options?.outDir ?? DEFAULT_OUT_DIR;

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
  const { graph, stationIds, outDir } = workerData;

  (async () => {
    for (const id of stationIds) {
      const table = await generateFareTableForStation(graph, id);
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
if (isMainThread && require.main === module) {
  (async () => {
    try {
      const startTime = Date.now();
      const r = await generateAndWriteAllFareTables();
      const endTime = Date.now();
      console.log('全駅の処理が完了しました。総数=', r.count);
      console.log(`Time taken: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    } catch (err) {
      console.error('エラーが発生しました...\n', err);
      process.exit(1);
    }
  })();
}
