import type { Adj, Graph } from "../types/graph.ts";
import { loadJson } from "./data.ts";
import { RAILWAYS } from "./railway.ts";

let adjPromise: Promise<Adj> | undefined;

/**
 * 全事業者のグラフを1つの隣接リストにまとめて読み込む関数
 * - 同じ駅IDは複数の事業者で同じ駅(改札内で乗り継げる駅)として扱う
 */
const loadMergedAdj = (): Promise<Adj> => {
  adjPromise ??= (async () => {
    const graphs = await Promise.all(RAILWAYS.map((r) => loadJson<Graph>(`data/${r}/fare/graph.json`)));
    const adj: Adj = {};
    for (const graph of graphs) {
      for (const [id, edges] of Object.entries(graph.adj)) {
        (adj[id] ??= []).push(...edges);
      }
    }
    return adj;
  })();
  return adjPromise;
};

/** 駅ごとの、全駅への最短の営業キロのキャッシュ */
const distanceCache = new Map<string, Promise<Record<string, number>>>();

/**
 * 指定した駅から全駅への、全事業者を通した最短の営業キロを求める関数 (Dijkstra法)
 * @returns 駅ID -> 営業キロ (0.1km単位、到達できない駅は含まない)
 */
export const getOperatingDistancesFrom = (startId: string): Promise<Record<string, number>> => {
  let cached = distanceCache.get(startId);
  if (cached) return cached;

  cached = loadMergedAdj().then((adj) => {
    const dist: Record<string, number> = { [startId]: 0 };
    const done = new Set<string>();
    // 要素は `[営業キロ, 駅ID]` の最小ヒープ
    const heap: [number, string][] = [[0, startId]];
    const push = (item: [number, string]) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = (): [number, string] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        while (true) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };

    while (heap.length) {
      const [d, id] = pop();
      if (done.has(id)) continue;
      done.add(id);
      for (const edge of adj[id] ?? []) {
        const nd = d + edge.weight;
        if (nd < (dist[edge.to] ?? Infinity)) {
          dist[edge.to] = nd;
          push([nd, edge.to]);
        }
      }
    }
    return dist;
  });
  distanceCache.set(startId, cached);
  return cached;
};
