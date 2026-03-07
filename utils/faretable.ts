import fs from 'fs/promises';
import path from 'path';

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

  await fs.mkdir(outDir, { recursive: true });

  for (const id of Object.keys(graph.stations)) {
    const table = await generateFareTableForStation(graph, id);
    const fp = path.join(outDir, `${id}.json`);
    await fs.writeFile(fp, JSON.stringify(table, null, 2), 'utf8');
  }

  return { outDir, count: graph.stations.length };
};

// CLI
if (require.main === module) {
  (async () => {
    try {
      const r = await generateAndWriteAllFareTables();
      console.log('全駅の処理が完了しました。総数=', r.count);
    } catch (err) {
      console.error('エラーが発生しました...\n', err);
      process.exit(1);
    }
  })();
}
