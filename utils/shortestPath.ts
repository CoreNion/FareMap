import type { Graph, Edge } from "../types/graph.ts";

/** 最短経路の計算結果 */
export interface ShortestPathResult {
  /** 運賃計算キロ(地方交通線のみの場合は営業キロ) */
  fareDistance: number;
  /** 営業キロ */
  operatingDistance: number;
  /** 地方交通線のみの経路かどうか */
  onlyChihou: boolean;
  /** 経路上の駅ID(発駅から着駅の順) */
  path: string[];
}

/**
 * 最短営業キロを計算する関数
 *
 * Dijkstra法で計算
 * @param graph Dijkstraで用いるグラフ
 * @param startId 開始駅ID
 * @param endId 到着駅ID
 * @returns 運賃計算キロ・営業キロ・地方交通線のみフラグ・経路
 */
export const calculateShortDistance = (graph: Graph, startId: string, endId: string): ShortestPathResult => {
  // ヒープは配列で実装した最小ヒープ（優先度付きキュー）。
  // 要素は `[distance, nodeId]` のタプルで、distance が小さい順に取り出す。
  type HeapItem = [number, string];
  const heap: HeapItem[] = [];
  const heapPush = (item: HeapItem) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const heapPop = (): HeapItem | undefined => {
    if (!heap.length) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  // 隣接リストと Dijkstra 用の距離配列・前駆点配列を初期化する
  const adj = graph.adj || {};
  const dist: Record<string, number> = {};
  // 前駆点には { from: string, edge: Edge } を保存して経路復元を可能にする
  const prev: Record<string, { from: string, edge: Edge } | null> = {};

  for (const id of Object.keys(graph.stations)) {
    dist[id] = Infinity;
    prev[id] = null;
  }

  dist[startId] = 0;
  heapPush([0, startId]);

  // メインループ
  while (true) {
    const cur = heapPop();
    if (!cur) break;
    const [d, u] = cur;
    if (d !== dist[u]) continue;
    if (u === endId) break;

    const edges = adj[u] || [];
    for (const e of edges) {
      // 混在時は地方交通線は fareWeight を使用する（運賃計算キロの算出）
      const cost = e.chihou ? e.fareWeight : e.weight;
      const nd = d + cost;
      if (nd < (dist[e.to] ?? Infinity)) {
        dist[e.to] = nd;
        prev[e.to] = { from: u, edge: e };
        heapPush([nd, e.to]);
      }
    }
  }

  if (!isFinite(dist[endId])) throw new Error('経路が見つかりません');

  // 経路復元して、地方交通線のみかどうかを判定する
  let onlyChihou = true;
  let operatingDistance = 0;
  const path = [endId];
  let curr = endId;
  while (prev[curr]) {
    const p = prev[curr]!;
    if (!p.edge.chihou) {
      onlyChihou = false;
    }
    operatingDistance += p.edge.weight;
    curr = p.from;
    path.push(curr);
  }
  path.reverse();

  // 地方交通線のみの場合は営業キロの合計を、そうでない場合は Dijkstra で求めた fareDistance (運賃計算キロ) を返す
  return {
    fareDistance: onlyChihou ? operatingDistance : dist[endId],
    operatingDistance,
    onlyChihou,
    path,
  };
}
