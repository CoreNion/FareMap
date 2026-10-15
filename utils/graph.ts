import fs from 'fs/promises';
import path from 'path';

import type { FareLines, FareStation, JrFareStation } from '../types/fare.ts';
import type { Graph, Edge } from '../types/graph.ts';

/**
 * 複数の路線データ(各路線の駅一覧)から、全駅辞書と隣接駅リストを含んだグラフ構造を構築する関数
 * 最短経路計算のためのグラフを生成する際に使用
 * @param lines 
 * @returns 
 */
export function buildGraphFromLines(lines: FareLines['lines']): Graph {
  const stations = new Map<string, FareStation>();
  const adj = new Map<string, Edge[]>();

  /**
   * 駅ノードを stations Map に登録・統合するヘルパー
   * - 既存ノードがあれば `sp` と `lines` をマージする
   * - 無ければ新規ノードを作成して登録する
   */
  function ensureNode(s: FareStation) {
    const existing = stations.get(s.id);
    if (existing) {
      // merge sp and lines
      const spSet = new Set([...(existing.sp || []), ...(s.sp || [])]);
      existing.sp = Array.from(spSet);
      existing.km = existing.km ?? s.km;
      return existing;
    }

    const node: FareStation = {
      id: s.id,
      name: s.name,
      km: s.km,
      sp: s.sp || [],
    };
    stations.set(s.id, node);
    return node;
  }

  /**
   * 隣接リストへ双方向エッジを追加する
   * - 重複を避けるため既存の同一エッジが無いかチェックする
   */
  function addEdge(u: string, v: string, weight: number, fareWeight: number, chihou: boolean) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);

    const listU = adj.get(u)!;
    if (!listU.some(e => e.to === v && Math.abs(e.weight - weight) < 1e-6 && Math.abs(e.fareWeight - fareWeight) < 1e-6 && e.chihou == chihou)) {
      listU.push({ to: v, weight, fareWeight, chihou });
    }

    const listV = adj.get(v)!;
    if (!listV.some(e => e.to === u && Math.abs(e.weight - weight) < 1e-6 && Math.abs(e.fareWeight - fareWeight) < 1e-6 && e.chihou == chihou)) {
      listV.push({ to: u, weight, fareWeight, chihou });
    }
  }

  // 各路線の駅リストを走査してノードとエッジを構築
  for (const line of lines) {
    const sts = line.stations;
    for (let i = 0; i < sts.length; i++) {
      const s = sts[i] as JrFareStation;
      ensureNode(s);
      if (i > 0) {
        const prev = sts[i - 1] as JrFareStation;;
        const w = (typeof s.km === 'number' && typeof prev.km === 'number') ? Math.abs(s.km - prev.km) : 1;

        // 地方交通線かどうかの情報・換算キロを追加
        const chihou = (typeof s.fareKm === 'number' && typeof prev.fareKm === 'number');
        const fareW = chihou ? Math.abs(s.fareKm - prev.fareKm) : w;
        addEdge(s.id, prev.id, w, fareW, chihou);
      }
    }
  }

  return {
    stations: Object.fromEntries(stations.entries()),
    adj: Object.fromEntries(adj.entries()),
  };
}

/**
 * 指定ディレクトリ（デフォルト: `public/jre/fare/lines`）配下の JSON ファイルを全て読み込み、
 * 各ファイル内の `lines` 配列を束ねて `buildGraphFromLines` に渡す。
 * - ファイルが壊れていても警告を出して処理を続行する（堅牢性を重視）
 * - 戻り値は `Graph` 型（`stations` と `adj`）
 */
export async function generateGraphFromFiles(dir?: string): Promise<Graph> {
  const base = dir ?? path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'lines');
  const entries = await fs.readdir(base, { withFileTypes: true });
  const linesArr: FareLines['lines'] = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.json')) continue;
    const fp = path.join(base, e.name);
    try {
      const txt = await fs.readFile(fp, 'utf8');
      const json = JSON.parse(txt) as FareLines | { lines: FareLines['lines'] };
      if (Array.isArray((json as FareLines).lines)) {
        linesArr.push(...(json as FareLines).lines);
      }
    } catch (err) {
      console.warn('generateGraphFromFiles: failed to parse', fp, err);
    }
  }

  return buildGraphFromLines(linesArr);
}

/**
 * グラフを生成してファイルへ書き出すユーティリティ
 * - `options.dir` を指定するとそのディレクトリ内の路線ファイルを読み込む
 * - `options.outPath` で出力先を変更可能（デフォルトは `public/data/jre/fare/graph.json`）
 * - 出力先ディレクトリが無ければ作成する
 */
export async function generateAndWriteGraph(options?: { dir?: string; outPath?: string }) {
  const dir = options?.dir;
  const outPath = options?.outPath ?? path.resolve(process.cwd(), 'public', 'data', 'jre', 'fare', 'graph.json');
  const graph = await generateGraphFromFiles(dir);
  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(graph, null, 2), 'utf8');
  return outPath;
}

// CLI
// 引数で事業者IDを指定すると、その事業者のグラフを生成する (例: `yarn generate-graph metro`)
if (require.main === module) {
  (async () => {
    try {
      const railway = process.argv[2] ?? 'jre';
      const fareDir = path.resolve(process.cwd(), 'public', 'data', railway, 'fare');
      const out = await generateAndWriteGraph({
        dir: path.join(fareDir, 'lines'),
        outPath: path.join(fareDir, 'graph.json'),
      });
      console.log('wrote', out);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
