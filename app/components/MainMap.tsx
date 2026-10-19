"use client";

import Map, { AttributionControl, GeolocateControl, Layer, MapLayerMouseEvent, MapProvider, Popup, Source, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Feature, Point } from "geojson";
import { useEffect, useState } from "react";

import { useMapStation } from "@/context/StationContext";
import { FareTable } from "@/types/fare";
import type { RailMode } from "@/types/map";
import type { RailwayId } from "@/types/railway";
import { RAILWAYS, RAILWAY_COLORS, RAILWAY_NAMES } from "@/utils/railway";

const MAP_STYLE_URL =
  "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json";

/**
 * MapLibre GL JS v6のWorkerのURL
 * - v6はWorkerの場所を`import.meta.url`から求めるが、バンドル後はWorkerを読み込めないため、
 *   バンドラーにアセットとして出力させたWorkerのURLを明示的に指定する
 */
const MAPLIBRE_WORKER_URL = new URL(
  "maplibre-gl/dist/maplibre-gl-worker.mjs",
  import.meta.url,
).href;

/** 路線の区分ごとの駅のGeoJSON */
const STATIONS_GEOJSON_URLS: Record<RailMode, string> = {
  jr: "data/jre/map.geojson",
  private: "data/private/map.geojson",
};

/** 全事業者の路線の線のGeoJSON */
const LINES_GEOJSON_URL = "data/lines.geojson";

/** 路線の区分ごとの運賃表のディレクトリ */
const FARE_DATA_DIRS: Record<RailMode, string> = {
  jr: "data/jre/fare",
  private: "data/private/fare",
};

/**
 * 駅アイコンの画像を事業者の色で塗った画像を作る関数
 * - 元の画像の不透明な部分だけを指定した色で塗りつぶす
 */
const createTintedImage = (image: HTMLImageElement | ImageBitmap, color: string): ImageData => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * 地図のイベントから取得したfeatureの事業者一覧を取り出す関数
 * - MapLibreのイベントでは、配列のプロパティがJSON文字列になるため変換する
 */
const parseRailways = (value: unknown): RailwayId[] | undefined => {
  if (typeof value === "string") return JSON.parse(value) as RailwayId[];
  return value as RailwayId[] | undefined;
};

/** 私鉄線モードで、JR線のみの駅かどうか */
const isJrOnlyStation = (railMode: RailMode, railways: RailwayId[] | undefined): boolean =>
  railMode === "private" && railways?.length === 1 && railways[0] === "jre";

export const MainMap = () => {
  return (
    <MapProvider>
      <Map
        id="faremap"
        initialViewState={{
          longitude: 139.7006,
          latitude: 35.68995,
          zoom: 10,
        }}
        maxBounds={[137.3318, 33, 141.5465, 38.3]}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100dvh",
          zIndex: -1,
        }}
        mapStyle={MAP_STYLE_URL}
        workerUrl={MAPLIBRE_WORKER_URL}
        attributionControl={false}
      >
        <MapController />
        <GeolocateControl position="bottom-right" />
        <AttributionControl position="bottom-left" compact={true}
          customAttribution={["地図上の駅・路線データ: 鉄道駅LOD(CC-BY-SA)を編集", "JR線の運賃データの出典: ＭＡＲＳ for MS-DOS", "都営地下鉄の運賃データ: 東京都オープンデータカタログ(CC-BY-SA)", "他の各社の路線・運賃情報は、各社の旅客営業規程やICカード乗車券取扱規則を参照", ]} />
      </Map>
    </MapProvider>
  );
};

const MapController = () => {
  const { current: map } = useMap();
  const { selectedStation, setSelectedStation, fareType, railMode, showJrStations } = useMapStation();
  const [geoStations, setGeoStations] = useState<GeoJSON.GeoJSON | null>(null);
  const [geoLines, setGeoLines] = useState<GeoJSON.GeoJSON | null>(null);
  // 運賃をGeoJSONへ反映し終えた発駅のID
  // ラベルの表示形式をデータの更新と同時に切り替え、再描画を1回にまとめるために使う
  const [fareStationId, setFareStationId] = useState<string | null>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popUpOptions, setPopUpOptions] = useState<{
    longitude: number;
    latitude: number;
    feature: Feature;
  } | null>(null);

  useEffect(() => {
    if (!map) return undefined;

    // クリーンアップ後の非同期処理の反映を防ぐためのフラグ
    let cancelled = false;

    (async () => {
      // 事業者ごとに色を付けた駅アイコンを登録する
      if (!map.hasImage("station-jre")) {
        const stIcon = await map.loadImage("icons/station.png");
        for (const railway of RAILWAYS) {
          const name = `station-${railway}`;
          // await中に別の実行が画像を登録している可能性があるため、追加直前に再確認する
          if (!cancelled && !map.hasImage(name)) {
            map.addImage(name, createTintedImage(stIcon.data, RAILWAY_COLORS[railway]));
          }
        }
      }

      // 路線の線は区分によらず共通のため、一度だけ読み込む
      const response = await fetch(LINES_GEOJSON_URL);
      const lines = await response.json() as GeoJSON.GeoJSON;
      if (cancelled) return;
      setGeoLines(lines);
    }
    )();

    // クリーンアップで解除できるように、ハンドラを変数として保持する
    const onLoad = () => {
      map.setGlyphs("https://mierune.github.io/fonts/{fontstack}/{range}.pbf");
    };

    const onStationClick = (e: MapLayerMouseEvent) => {
      const coordinates = (e.features![0].geometry as Point).coordinates.slice();

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      setPopUpOptions({
        longitude: coordinates[0],
        latitude: coordinates[1],
        feature: e.features![0],
      });
      setShowPopup(true);
    };

    const onStationMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onStationMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on("load", onLoad);
    map.on("click", "stations", onStationClick);
    map.on('mouseenter', 'stations', onStationMouseEnter);
    map.on('mouseleave', 'stations', onStationMouseLeave);

    return () => {
      cancelled = true;
      map.off("load", onLoad);
      map.off("click", "stations", onStationClick);
      map.off('mouseenter', 'stations', onStationMouseEnter);
      map.off('mouseleave', 'stations', onStationMouseLeave);
    };
  }, [map]);

  // 路線の区分に応じた駅のGeoJSONを読み込む
  useEffect(() => {
    // 区分を素早く切り替えた際に、古いリクエストの結果で上書きしないためのフラグ
    let cancelled = false;

    (async () => {
      const response = await fetch(STATIONS_GEOJSON_URLS[railMode]);
      const data = await response.json() as GeoJSON.FeatureCollection;
      if (cancelled) return;

      // 私鉄線モードでは、JR線のみの駅の表示を切り替えられるように印を付ける
      const features = data.features.map((feature) => {
        const jrOnly = isJrOnlyStation(railMode, feature.properties?.railways);
        return {
          ...feature,
          properties: { ...feature.properties, jrOnly, hidden: false },
        };
      });
      setGeoStations({ ...data, features });
      setFareStationId(null);
      setShowPopup(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [railMode]);

  useEffect(() => {
    const stationId = selectedStation?.id;
    if (!stationId) return undefined;

    // 駅を素早く切り替えた際に、古いリクエストの結果で上書きしないためのフラグ
    let cancelled = false;

    (async () => {
      // 運賃の種別に応じて、きっぷ運賃またはIC運賃の運賃表を取得する
      const tableDir = fareType === "ic" ? "ic-table" : "table";
      const response = await fetch(`${FARE_DATA_DIRS[railMode]}/${tableDir}/${stationId}.json`);
      // 区分の切り替え直後など、運賃表が無い駅の場合は何もしない
      if (!response.ok) return;
      const data = await response.json() as FareTable;
      if (cancelled) return;

      // 各駅の運賃をGeoJSONのプロパティに追加
      // 最新のGeoJSONを基にするため、関数形式で更新する
      setGeoStations((prev) => {
        if (!prev) return prev;
        const features = prev as GeoJSON.FeatureCollection;
        const updatedFeatures = features.features.map((feature) => {
          const stId = feature.properties!.id;
          const fare = data.fares[stId];
          const isSelectedSt = stId != stationId;
          // JR線モードは、JR線のみではない経路の場合に経由する他社線を表示する
          // 私鉄線モードは、他社線をまたぐ経路の場合に利用する全事業者を表示する
          const via = data.via?.[stId]
            ?.filter((r) => railMode === "private" || r !== "jre")
            .map((r) => RAILWAY_NAMES[r]).join("・");

          return {
            ...feature,
            properties: {
              ...feature.properties,
              fare: isSelectedSt ?
                (fare ? `${fare}円` : "情報なし") : "発駅",
              via: via ? `${via}経由` : "",
              // 運賃の無い駅(範囲外・経路が無い駅)は表示しない
              // (JR線のみの駅は、JR線区間が100km以内の駅のみ運賃表に含まれる)
              hidden: isSelectedSt && fare == null,
            },
          };
        });

        return {
          ...features,
          features: updatedFeatures,
        };
      });
      // データ更新と同じバッチで表示形式を切り替える
      setFareStationId(stationId);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedStation?.id, fareType, railMode]);

  // 私鉄線モードでJR線の駅を表示するか (発駅の選択前は表示しない)
  const showJr = railMode === "jr" || (!!selectedStation && showJrStations);

  return geoStations ? (
    <>
    <Source id="stations-source" type="geojson" data={geoStations}>
      <Layer
        id="stations"
        type="symbol"
        source="stations-source"
        filter={showJr ? ["!=", ["get", "hidden"], true] :
          ["all", ["!=", ["get", "hidden"], true], ["!=", ["get", "jrOnly"], true]]}
        layout={{
          "icon-image": ["concat", "station-", ["coalesce", ["get", "railway"], "jre"]],
          "icon-size": 0.07,
          "text-font": ["mplus2p-regular"],
          "text-size": 17,
          "text-field": fareStationId ?
            [
              "format",
              ["get", "name"], { "text-color": "#555" }, "\n", {},
              ["get", "fare"], { "font-scale": 1.2, 'text-font': ['literal', ['mplus2p-medium']] }
            ] :
            ["get", "name"],
          'text-anchor': 'top',
          'text-offset': [0, 1],
          'symbol-sort-key': ['get', 'sortKey']
        }}
      />
      {
        showPopup && <Popup longitude={popUpOptions!.longitude} latitude={popUpOptions!.latitude} onClose={() => setShowPopup(false)} maxWidth="none">
          <div className="popup grid grid-cols-1 gap-1 text-base antialiased">
            <h3 className="text-lg font-bold">{popUpOptions!.feature.properties!.name}駅</h3>
            {popUpOptions!.feature.properties!.fare && popUpOptions!.feature.properties!.id != selectedStation!.id
              &&
              <span>{selectedStation!.name}駅からの{fareType === "ic" ? "IC" : "切符"}運賃: <strong>{popUpOptions!.feature.properties!.fare}</strong></span>
            }
            {popUpOptions!.feature.properties!.via && popUpOptions!.feature.properties!.id != selectedStation?.id
              &&
              <span className="text-xs">({popUpOptions!.feature.properties!.via}の最安経路)</span>
            }
            {
              popUpOptions!.feature.properties!.jrOnly ?
                <span className="text-xs">JR線の駅からの運賃は、JR線の表示で確認できます</span> :
              popUpOptions!.feature.properties!.id != selectedStation?.id ?
                <button className="p-1 bg-green-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-green-300" onClick={() => {
                  const feature = popUpOptions!.feature;
                  const coordinates = (feature.geometry as Point).coordinates;
                  setSelectedStation({
                    id: feature.properties!.id,
                    name: feature.properties!.name,
                    railways: parseRailways(feature.properties!.railways),
                  });
                  setShowPopup(false);
                  map?.flyTo(
                    {
                      center: [coordinates[0], coordinates[1]],
                      zoom: 10,
                      speed: 2,
                      essential: true
                    }
                  )
                }}>当駅からの運賃を表示</button>
                : <span className="text-xs">当駅からの運賃を表示中</span>
            }
          </div>
        </Popup>
      }
    </Source>
    {/* 路線の線は駅の下に表示する (駅のレイヤーの追加後に、その下へ挿入する) */}
    {geoLines &&
      <Source id="lines-source" type="geojson" data={geoLines}>
        <Layer
          id="lines"
          type="line"
          source="lines-source"
          beforeId="stations"
          filter={railMode === "jr" ? ["==", ["get", "railway"], "jre"] :
            showJr ? ["boolean", true] : ["!=", ["get", "railway"], "jre"]}
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 12, 4, 15, 6],
            "line-opacity": 0.8,
          }}
        />
      </Source>
    }
    </>
  ) : <></>;
}