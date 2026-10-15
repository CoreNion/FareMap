const jsonCache = new Map<string, unknown>();
// 存在しなかったファイルのURL
const missingUrls = new Set<string>();

/**
 * 環境に応じた形でJSONファイルを読み込む関数
 * @param url `/data/...` 形式のURL
 * @returns 読み込んだJSON
 */
export const loadJson = async <T>(url: string): Promise<T> => {
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
 * JSONファイルを読み込み、存在しない場合は`undefined`を返す関数
 * - 事業者によって存在しないファイル(special.jsonなど)の読み込みに使う
 */
export const loadOptionalJson = async <T>(url: string): Promise<T | undefined> => {
  if (missingUrls.has(url)) return undefined;
  try {
    return await loadJson<T>(url);
  } catch {
    // 存在しないファイルを何度も読みに行かないように記録しておく
    missingUrls.add(url);
    return undefined;
  }
}
