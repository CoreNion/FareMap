import fs from 'fs/promises';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';

import type { Graph } from '../types/graph.ts';
import type { SUPPORTED_RAILWAY } from '../types/railway.ts';
import { calculateFare } from './calc.ts';
import { isSupportedRailway } from './railway.ts';

/** 鉄道会社ごとの運賃データのディレクトリ */
const getFareDir = (railway: SUPPORTED_RAILWAY) => path.resolve(process.cwd(), 'public', 'data', railway, 'fare');

const readJson = async <T>(p: string): Promise<T> => {
  const txt = await fs.readFile(p, 'utf8');
  return JSON.parse(txt) as T;
};

/**
 * 指定した駅からグラフ内にある全駅への運賃を計算し、運賃テーブルを生成する
 * @param graph 
 * @param stationID 
 * @param railway 鉄道会社コード
 * @returns 
 */
export const generateFareTableForStation = async (
  graph: Graph,
  stationID: string,
  railway: SUPPORTED_RAILWAY = 'jre'
): Promise<{ id: string; name: string; fares: Record<string, number | null> }> => {
  const st = graph.stations[stationID];
  if (!st) throw new Error('駅が存在しません: ' + stationID);
  const fares: Record<string, number | null> = {};

  // グラフ内の全駅に対して運賃を計算する
  for (const toId of Object.keys(graph.stations)) {
    const toSt = graph.stations[toId];
    try {
      const f = await calculateFare(st, toSt, railway);
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
  railway?: SUPPORTED_RAILWAY;
}) => {
  const railway = options?.railway ?? 'jre';
  const graphPath = options?.graphPath ?? path.join(getFareDir(railway), 'graph.json');
  const outDir = options?.outDir ?? path.join(getFareDir(railway), 'table');

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
          railway,
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
  const { graph, stationIds, outDir, railway } = workerData;

  (async () => {
    for (const id of stationIds) {
      const table = await generateFareTableForStation(graph, id, railway);
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

// CLI (第1引数で鉄道会社コードを指定する 例: `yarn generate-faretable toei`)
if (isMainThread && require.main === module) {
  (async () => {
    try {
      const railway = process.argv[2] ?? 'jre';
      if (!isSupportedRailway(railway)) throw new Error(`未定義の鉄道会社です: ${railway}`);
      const startTime = Date.now();
      const r = await generateAndWriteAllFareTables({ railway });
      const endTime = Date.now();
      console.log('全駅の処理が完了しました。総数=', r.count);
      console.log(`Time taken: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    } catch (err) {
      console.error('エラーが発生しました...\n', err);
      process.exit(1);
    }
  })();
}
