import type { FareStation, ICFareRange, JrFareData, JrFareStation, SpecialFareTable, ToeiFareData } from "../types/fare.ts"
import type { SUPPORTED_RAILWAY } from "../types/railway.ts"
import type { Graph, Edge } from "../types/graph.ts";

const jsonCache = new Map<string, unknown>();

/**
 * 環境に応じた形でJSONファイルを読み込む関数
 * @param url 
 * @returns 
 */
const loadJson = async <T>(url: string): Promise<T> => {
  if (jsonCache.has(url)) {
    return jsonCache.get(url) as T;
  }

  // ブラウザ環境ならfetchでURLから読み込む
  if (typeof window !== 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    jsonCache.set(url, data);
    return data as T;
  }

  // Node.js(スクリプト)ならpublic配下のファイルを読み込む
  const { readFile } = await import('fs/promises');
  const { join } = await import('path');
  const diskPath = join(process.cwd(), 'public', ...url.replace(/^\/+/, '').split('/'));
  const txt = await readFile(diskPath, 'utf-8');
  const data = JSON.parse(txt);
  jsonCache.set(url, data);
  return data as T;
}

/**
 * 運賃表から営業キロ(km単位)に対応する運賃を検索する関数
 * @param table 運賃表
 * @param km 営業キロ (km単位の整数)
 * @returns 対応する運賃 (範囲外の場合は0)
 */
const findFareInTable = (table: ICFareRange[], km: number): number =>
  table.find((range) => km >= range.startK && km <= range.endK)?.fare ?? 0;

/**
 * 営業キロから運賃を求める関数
 * @param distance 営業キロ (0.1km単位)
 * @param railway 鉄道会社コード
 * @param onlyChihou 地方交通線のみかどうか (JRのみ使用)
 * @returns 営業キロに対応する運賃
 */
const distanceToFare = async (distance: number, railway: SUPPORTED_RAILWAY, onlyChihou: boolean): Promise<number> => {
  switch (railway) {
    case 'jre': {
      const fareData = await loadJson<JrFareData>('/data/jre/fare/2026.json');

      // 1km未満は1kmとして扱い、1km以上は端数を切り上げる
      if (distance % 10 !== 0) {
        distance = distance < 10 ? 10 : Math.floor(distance / 10) * 10;
      }

      const table = onlyChihou ? fareData.chihou : fareData.kansen;

      let fare = 0;
      for (const range of table) {
        if (distance >= (range.startK * 10) && distance <= (range.endK * 10)) {
          fare = range.fare;
          break;
        }
      }
      return fare;
    }
    case 'toei': {
      const fareData = await loadJson<ToeiFareData>('/data/toei/fare/2026.json');
      // 1km未満の端数は1kmに切り上げる (0kmの場合も最低1kmとして扱う)
      const km = Math.max(1, Math.ceil(distance / 10));
      return findFareInTable(fareData.normal, km);
    }
    default:
      throw new Error(`未定義の鉄道会社です: ${railway}`);
  }
}

/**
 * 最短経路の運賃計算を行う関数
 * @param startSt 出発駅
 * @param endSt 到着駅
 * @param railway 鉄道会社コード
 * @returns 計算された運賃
 */
export const calculateFare = async (startSt: FareStation, endSt: FareStation, railway: SUPPORTED_RAILWAY = 'jre'): Promise<number> => {
  const graph = await loadJson<Graph>(`/data/${railway}/fare/graph.json`);

  const startId = startSt.id;
  const endId = endSt.id;
  if (!graph.stations?.[startId] || !graph.stations?.[endId]) {
    throw new Error('start または end 駅がグラフに存在しません');
  }

  switch (railway) {
    case 'jre': {
      const specialFareTable = await loadJson<SpecialFareTable>('/data/jre/fare/special.json');

      // 特別な運賃が適用されている場合はそれを返す
      const specialFare = specialFareTable.specialFares.find(
        (s) => (s.to == startId && s.from == endId) || (s.from == startId && s.to == endId)
      );
      if (specialFare) return specialFare.fare;

      // 営業キロの算出を行う
      const { fareDistance, onlyChihou } = calcJrFareDistance(graph, (startSt as JrFareStation), (endSt as JrFareStation))

      // 営業キロを運賃に変換
      return await distanceToFare(fareDistance, 'jre', onlyChihou);
    }
    case 'toei': {
      // 都営地下鉄は最短経路の営業キロで運賃を算出する
      const { fareDistance } = calculateShortDistance(graph, startId, endId);
      return await distanceToFare(fareDistance, 'toei', false);
    }
    default:
      throw new Error(`未定義の鉄道会社です: ${railway}`);
  }
}

/**
 * JR線の営業キロの計算を行う関数
 * 
 * - 特定都区市内の場合の処理に対応
 */
const calcJrFareDistance = (graph: Graph, startSt: JrFareStation, endSt: JrFareStation): { fareDistance: number, onlyChihou: boolean } => {
  const startId = startSt.id;
  const startSp = startSt.sp;
  const endId = endSt.id;
  const endSp = endSt.sp;

  // 特定都区市内の処理
  if ((startSp.length == 0 && endSp.length == 0) || startSp.find((sp) => endSp.includes(sp))) {
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
    const res = calculateShortDistance(graph, startSpCalcStId, endSpCalcStId);
    if ((isYamanote && (res.fareDistance >= 1001 && res.fareDistance <= 2000))
      || res.fareDistance >= 2001) {
      return res;
    } else {
      return calculateShortDistance(graph, startId, endId);
    }
  } else {
    return calculateShortDistance(graph, startId, endId);
  }
}

/**
 * 最短営業キロを計算する関数
 * 
 * Dijkstra法で計算
 * @param graph Dijkstraで用いるグラフ
 * @param startId 開始駅ID
 * @param endId 到着駅ID
 * @returns 運賃計算キロと地方交通線のみフラグ
 */
const calculateShortDistance = (graph: Graph, startId: string, endId: string): { fareDistance: number, onlyChihou: boolean } => {
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
  let curr = endId;
  while (prev[curr]) {
    const p = prev[curr]!;
    if (!p.edge.chihou) {
      onlyChihou = false;
    }
    operatingDistance += p.edge.weight;
    curr = p.from;
  }

  // 地方交通線のみの場合は営業キロの合計を、そうでない場合は Dijkstra で求めた fareDistance (運賃計算キロ) を返す
  return {
    fareDistance: onlyChihou ? operatingDistance : dist[endId],
    onlyChihou
  };
}