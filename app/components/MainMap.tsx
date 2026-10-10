"use client";

import Map, { AttributionControl, GeolocateControl, Layer, MapLayerMouseEvent, MapProvider, Popup, Source, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Feature, Point } from "geojson";
import { useEffect, useState } from "react";

import { useMapStation } from "@/context/StationContext";
import { FareTable } from "@/types/fare";
import type { SUPPORTED_RAILWAY } from "@/types/railway";

const MAP_STYLE_URL =
  "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json";

/** 事業者ごとの駅GeoJSONのURL */
const getStationsGeoJsonUrl = (railway: SUPPORTED_RAILWAY) => `data/${railway}/map.geojson`;

export const MainMap = () => {
  const { railway } = useMapStation();

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
        attributionControl={false}
      >
        {/* 事業者の切り替え時に、運賃表示やポップアップの状態ごとリセットするためkeyを指定する */}
        <MapController key={railway} />
        <GeolocateControl position="bottom-right" />
        <AttributionControl position="bottom-left" customAttribution={[
          "地図上の駅・路線データ: 鉄道駅LOD(CC-BY-SA)を編集",
          "JR線の運賃データの出典: ＭＡＲＳ for MS-DOS",
          "都営地下鉄の運賃データの出典: 東京都オープンデータカタログ(CC-BY-SA)",
        ]} />
      </Map>
    </MapProvider>
  );
};

const MapController = () => {
  const { current: map } = useMap();
  const { railway, selectedStation, setSelectedStation } = useMapStation();
  const [geoStations, setGeoStations] = useState<GeoJSON.GeoJSON | null>(null);
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
      if (!map.hasImage("station")) {
        const stIcon = await map.loadImage("icons/station.png");
        // await中に別の実行が画像を登録している可能性があるため、追加直前に再確認する
        if (!cancelled && !map.hasImage("station")) {
          map.addImage("station", stIcon.data);
        }
      }

      const response = await fetch(getStationsGeoJsonUrl(railway));
      const data = await response.json() as GeoJSON.GeoJSON;
      if (cancelled) return;
      setGeoStations(data);
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
  }, [map, railway]);

  useEffect(() => {
    const stationId = selectedStation?.id;
    if (!stationId) return undefined;

    // 駅を素早く切り替えた際に、古いリクエストの結果で上書きしないためのフラグ
    let cancelled = false;

    (async () => {
      const response = await fetch(`data/${railway}/fare/table/${stationId}.json`);
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

          return {
            ...feature,
            properties: {
              ...feature.properties,
              fare: isSelectedSt ?
                (fare ? `${fare}円` : "情報なし") : "発駅",
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
  }, [selectedStation?.id, railway]);

  return geoStations ? (
    <Source id="stations-source" type="geojson" data={geoStations}>
      <Layer
        id="stations"
        type="symbol"
        source="stations-source"
        layout={{
          "icon-image": "station",
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
              <span>{selectedStation!.name}駅からの運賃: <strong>{popUpOptions!.feature.properties!.fare}</strong></span>
            }
            {
              popUpOptions!.feature.properties!.id != selectedStation?.id ?
                <button className="p-1 bg-green-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-green-300" onClick={() => {
                  const feature = popUpOptions!.feature;
                  const coordinates = (feature.geometry as Point).coordinates;
                  setSelectedStation({
                    id: feature.properties!.id,
                    name: feature.properties!.name,
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
  ) : <></>;
}