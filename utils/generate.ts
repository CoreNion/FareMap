import fs from 'fs/promises';
import path from 'path';

import { FareLine, FareStation } from '../types/fare';
import { Graph, Edge } from '../types/calc';

/**
 * 複数の路線データ(各路線の駅一覧)から、全駅辞書と隣接駅リストを含んだグラフ構造を構築する関数
 * 最短経路計算のためのグラフを生成する際に使用
 * @param lines 
 * @returns 
 */
export function buildGraphFromLines(lines: FareLine['lines']): Graph {
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
   * - `type` によって線路上の隣接か乗換エッジかを区別可能
   */
  function addEdge(u: string, v: string, weight: number, type: 'line' | 'transfer' = 'line') {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);

    const listU = adj.get(u)!;
    if (!listU.some(e => e.to === v && Math.abs(e.weight - weight) < 1e-6 && e.type === type)) {
      listU.push({ to: v, weight, type });
    }

    const listV = adj.get(v)!;
    if (!listV.some(e => e.to === u && Math.abs(e.weight - weight) < 1e-6 && e.type === type)) {
      listV.push({ to: u, weight, type });
    }
  }

  // 各路線の駅リストを走査してノードとエッジを構築
  for (const line of lines) {
    const sts = line.stations;
    for (let i = 0; i < sts.length; i++) {
      const s = sts[i];
      ensureNode(s);
      if (i > 0) {
        const prev = sts[i - 1];
        const w = (typeof s.km === 'number' && typeof prev.km === 'number') ? Math.abs(s.km - prev.km) : 1;
        addEdge(s.id, prev.id, w, 'line');
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
  const base = dir ?? path.resolve(process.cwd(), 'public', 'jre', 'fare', 'lines');
  const entries = await fs.readdir(base, { withFileTypes: true });
  const linesArr: FareLine['lines'] = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.json')) continue;
    const fp = path.join(base, e.name);
    try {
      const txt = await fs.readFile(fp, 'utf8');
      const json = JSON.parse(txt) as FareLine | { lines: FareLine['lines'] };
      if (Array.isArray((json as FareLine).lines)) {
        linesArr.push(...(json as FareLine).lines);
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
 * - `options.outPath` で出力先を変更可能（デフォルトは `public/jre/fare/graph.json`）
 * - 出力先ディレクトリが無ければ作成する
 */
export async function generateAndWriteGraph(options?: { dir?: string; outPath?: string }) {
  const dir = options?.dir;
  const outPath = options?.outPath ?? path.resolve(process.cwd(), 'public', 'jre', 'fare', 'graph.json');
  const graph = await generateGraphFromFiles(dir);
  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(graph, null, 2), 'utf8');
  return outPath;
}

// CLI
if (require.main === module) {
  (async () => {
    try {
      const out = await generateAndWriteGraph();
      console.log('wrote', out);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
