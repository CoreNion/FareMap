import { FareStation, JrFareData } from "@/types/fare"
import { SUPPORTED_RAILWAY } from "../types/railway"
import { Graph } from "../types/calc";

/**
 * 営業キロから運賃を求める関数
 * @param distance 営業キロ
 * @param railway 鉄道会社コード
 * @returns 営業キロに対応する運賃
 */
const distanceToFare = async (distance: number, railway: SUPPORTED_RAILWAY): Promise<number> => {
  let fareData: JrFareData;
  switch (railway) {
    case 'jre':
      fareData = await fetch('/jre/fare/2026.json').then(res => res.json()) as JrFareData;
      break;
    default:
      throw new Error(`未定義の鉄道会社です: ${railway}`);
  }

  let fare = 0;

  // 1km未満は1kmとして扱い、1km以上は端数を切り上げる
  if (distance % 10 !== 0) {
    distance = distance < 10 ? 10 : Math.floor(distance / 10) * 10;
  }
  
  for (const range of fareData.kansen) {
    if (distance >= (range.startK * 10) && distance <= (range.endK * 10)) {
      fare = range.fare;
      break;
    }
  }
  return fare;
}

/**
 * 最短経路の運賃計算を行う関数
 * Dijkstra法で経路の合計距離(重み合計)を計算し、その距離から運賃を求める。
 * @param startSt 出発駅
 * @param endSt 到着駅
 * @returns 計算された運賃
 */
export const calculateFare = async (startSt: FareStation, endSt: FareStation): Promise<number> => {
  const graph = await fetch('/jre/fare/graph.json').then(res => res.json()) as Graph;

  const startId = startSt.id;
  const endId = endSt.id;
  if (!graph.stations?.[startId] || !graph.stations?.[endId]) {
    throw new Error('start または end 駅がグラフに存在しません');
  }

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
  const prev: Record<string, string | null> = {};

  for (const id of Object.keys(graph.stations)) {
    dist[id] = Infinity;
    prev[id] = null;
  }

  dist[startId] = 0;
  heapPush([0, startId]);

  // メインループ: 最小距離のノードを取り出し、隣接辺を緩和する
  // - 各頂点は到達可能な最小距離が確定するとその距離で処理される
  // - 到達距離が更新された隣接ノードはヒープへ追加する（複数エントリが残る可能性があるが、
  //   pop 時に距離が現在の dist と一致しないものは無視する）
  while (true) {
    const cur = heapPop();
    if (!cur) break;
    const [d, u] = cur;
    // ヒープから取り出した距離が最新でなければ無視
    if (d !== dist[u]) continue;
    // 目的地へ到達したらループ終了（最短距離が確定）
    if (u === endId) break;

    const edges = adj[u] || [];
    for (const e of edges) {
      const w = typeof e.weight === 'number' ? e.weight : 1;
      const nd = d + w;
      // より短い経路を発見したら距離・前駆点を更新してヒープへ追加
      if (nd < (dist[e.to] ?? Infinity)) {
        dist[e.to] = nd;
        prev[e.to] = u;
        heapPush([nd, e.to]);
      }
    }
  }

  const totalDistance = dist[endId];
  if (!isFinite(totalDistance)) throw new Error('経路が見つかりません');

  // 営業キロを運賃に変換
  const fare = await distanceToFare(totalDistance, 'jre');
  return fare;
}