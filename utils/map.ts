import fs from 'fs/promises';
import path from 'path';
import { Graph } from '../types/calc';

import type { Feature, FeatureCollection } from 'geojson';

/**
 * GeoJSON(鉄道駅LOD GeoJSON)を運賃マップで使うデータに加工する
 * - geometry.typeがPoint以外のfeatureは削除し、駅データのみを残す
 * - 全てのfeatureのuriプロパティを削除
 * - feature.properties.nameとgraph.stationsのnameを照合して、対応するstation.idをfeature.properties.idに追加
 * 
 * @param geojson 変換前のGeoJSON (FeatureCollection)
 * @param graph 駅情報のグラフデータ
 * @returns 変換後のGeoJSON
 */
export const transformGeoJSON = (geojson: FeatureCollection, graph: Graph) => {
  if (!geojson || !geojson.features) return geojson;

  const stations = Object.values(graph.stations);
  
  const transformedFeatures = geojson.features
    .filter((feature: Feature) => {
      if (feature.geometry?.type === 'Point' && feature.properties?.name) {
        // 運賃マップに存在しない駅は削除
        const station = stations.find(s => s.name === feature.properties?.name);
        return !!station; 
      } else {
        // 駅Point以外のfeatureは削除
        return false;
      }
    }).map((feature: Feature) => {
      if (feature.properties) {
        // 全てのfeatureのuriプロパティを削除
        delete feature.properties.uri;

        // 対応するstation.idを追加
        const station = stations.find(s => s.name === feature.properties!.name);
        feature.properties.id = station!.id;
      }
      
      return feature;
    });

  return {
    ...geojson,
    features: transformedFeatures
  };
}

/**
 * 指定ディレクトリのGeoJSONファイルをすべて変換し、一つのGeoJSONファイルとして保存する関数
 * 
 * @param mapDir GeoJSONファイルが格納されているディレクトリ
 * @param graphPath graph.jsonのパス
 * @param outputPath 変換後のGeoJSONを保存するパス
 */
export const processGeoJSONFiles = async (mapDir: string, graphPath: string, outputPath: string) => {
  const graphContent = await fs.readFile(graphPath, 'utf8');
  const graph: Graph = JSON.parse(graphContent);
  
  const files = await fs.readdir(mapDir);
  const geojsonFiles = files.filter(f => f.endsWith('.geojson'));

  let allFeatures: Feature[] = [];

  for (const file of geojsonFiles) {
    const filePath = path.join(mapDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const geojson = JSON.parse(content);
    
    const transformed = transformGeoJSON(geojson, graph);
    allFeatures = allFeatures.concat(transformed.features);
  }

  // 重複するfeatureを削除（idが同じものは一つだけ残す）
  const uniqueAllFeatures = allFeatures.filter((feature, index, self) =>
    index === self.findIndex(f => f.properties?.id === feature.properties?.id)
  );

  const outputGeoJSON = {
    type: "FeatureCollection",
    features: uniqueAllFeatures
  };

  await fs.writeFile(outputPath, JSON.stringify(outputGeoJSON, null, 2), 'utf8');
}

// CLI
if (require.main === module) {
  (async () => {
    try {
      const mapDir = path.resolve(process.cwd(), 'public', 'jre', 'map');
      const graphPath = path.resolve(process.cwd(), 'public', 'jre', 'fare', 'graph.json');
      const outputPath = path.resolve(process.cwd(), 'public', 'jre' , 'map.geojson');
      
      console.log('変換開始...');
      await processGeoJSONFiles(mapDir, graphPath, outputPath);
      console.log('変換が完了しました');
    } catch (err) {
      console.error('変換中にエラーが発生しました...', err);
      process.exit(1);
    }
  })();
}
