import { FareStation, JrFareData } from "@/types/fare"
import { SUPPORTED_RAILWAY } from "../types/railway"
import { Graph } from "../types/calc";

/**
 * 環境に応じた形でJSONファイルを読み込む関数
 * @param url 
 * @returns 
 */
const loadJson = async <T>(url: string): Promise<T> => {
  // ブラウザ環境ならfetchでURLから読み込む
  if (typeof window !== 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  // Node.js(スクリプト)ならpublic配下のファイルを読み込む
  const { readFile } = await import('fs/promises');
  const { join } = await import('path');
  const diskPath = join(process.cwd(), 'public', ...url.replace(/^\/+/, '').split('/'));
  const txt = await readFile(diskPath, 'utf-8');
  return JSON.parse(txt) as T;
}

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
      fareData = await loadJson<JrFareData>('/data/jre/fare/2026.json');
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
 * @param startSt 出発駅
 * @param endSt 到着駅
 * @returns 計算された運賃
 */
export const calculateFare = async (startSt: FareStation, endSt: FareStation): Promise<number> => {
  const graph = await loadJson<Graph>('/data/jre/fare/graph.json');

  const startId = startSt.id;
  const endId = endSt.id;
  if (!graph.stations?.[startId] || !graph.stations?.[endId]) {
    throw new Error('start または end 駅がグラフに存在しません');
  }

  // 特定都区市内の処理
  const distance = calcJrFareDistance(graph, startSt, endSt)

  // 営業キロを運賃に変換
  const fare = await distanceToFare(distance, 'jre');
  return fare;
}

/**
 * 特定都区市内の場合に、営業キロが100kmを超える場合は中心駅を返す関数
 */
const calcJrFareDistance = (graph: Graph, startSt: FareStation, endSt: FareStation) => {
  const startId = startSt.id;
  const startSp = startSt.sp;
  const endId = endSt.id;
  const endSp = endSt.sp;

  // 特定都区市内の対象外ならパス
  if (startSp.length == 0 && endSp.length ==0) {
    return calculateShortDistance(graph, startId, endId);
  }

  // 同じ特定都区市内ならパス
  if (startSp.find((sp) => endSp.includes(sp))) {
    return calculateShortDistance(graph, startId, endId);
  }

  // 計算すべき駅を取得する関数 (特定区間の場合は中心駅を取得)
  const getSpCalcStId = (st: FareStation) => {
    if (st.sp.includes("yamanote") || st.sp.includes("tokunai")) {
      return "tokyo";
    } else {
      switch (st.sp[0]) {
        case 'yamanote':
        case 'tokunai':
          return "tokyo";
        case 'yokohama':
          return "yokohama";
        case 'sapporo':
          return "sapporo";
        case 'sendai':
          return "sendai";
        case 'nagoya':
          return "nagoya";
        case 'kyoto':
          return "kyoto";
        case 'osaka':
          return "osaka";
        case 'kobe':
          return "kobe";
        case 'hiroshima':
          return "hiroshima";
        case 'kitakyusyu':
          return "kokura";
        case 'fukuoka':
          return "hakata";
        default:
          return st.id;
      }
    }
  }

  // 特定区間の場合は中心駅を取得
  const startSpCalcStId = getSpCalcStId(startSt);
  const endSpCalcStId = getSpCalcStId(endSt);
  
  // 特定区間の中心駅までの距離を算出し、201km以上の場合はその距離を使用する
  // 山手線内のみ、101km～200kmの場合は中心駅(東京駅)までの営業キロを使用する
  // 201/101km未満の場合は通常通り算出する
  const isYamanote = startSt.sp.includes("yamanote") || endSt.sp.includes("yamanote");
  const distance = calculateShortDistance(graph, startSpCalcStId, endSpCalcStId);
  if ((isYamanote && (distance >= 1001 && distance <= 2000))
    || distance >= 2001) {
    return distance;
  } else {
    return calculateShortDistance(graph, startId, endId);
  }
}

/**
 * 最短営業キロを計算する関数
 * 
 * Dijkstra法で計算
 * @param graph Dijkstraで用いるグラフ
 * @param startSt 開始駅
 * @param endSt 到着駅
 * @returns 営業キロ
 */
const calculateShortDistance = (graph: Graph, startId: string, endId: string) => {
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
  return totalDistance;
}