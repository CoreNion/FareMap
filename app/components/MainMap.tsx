"use client";

import Map, { AttributionControl, GeolocateControl, Layer, MapLayerMouseEvent, MapProvider, Popup, Source, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Feature, Point } from "geojson";
import { useEffect, useState } from "react";

import { useMapStation } from "@/context/StationContext";
import { FareTable } from "@/types/fare";

const MAP_STYLE_URL =
  "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json";

const STATIONS_GEOJSON_URL = "data/jre/map.geojson";

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
        attributionControl={false}
      >
        <MapController />
        <GeolocateControl position="bottom-right" />
        <AttributionControl position="bottom-left" customAttribution={["地図上の駅・路線データ: 鉄道駅LOD(CC-BY-SA)を編集","JR線の運賃データの出典: ＭＡＲＳ for MS-DOS"]} />
      </Map>
    </MapProvider>
  );
};

const MapController = () => {
  const { current: map } = useMap();
  const { selectedStation, setSelectedStation } = useMapStation();
  const [geoStations, setGeoStations] = useState<GeoJSON.GeoJSON | null>(null);

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

      const response = await fetch(STATIONS_GEOJSON_URL);
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
  }, [map]);

  useEffect(() => {
    if (selectedStation?.id) {
      (async () => {
        const response = await fetch(`data/jre/fare/table/${selectedStation.id}.json`);
        const data = await response.json() as FareTable;

        // 各駅の運賃をGeoJSONのプロパティに追加
        const features = geoStations as GeoJSON.FeatureCollection;
        const updatedFeatures = features.features.map((feature) => {
          const stId = feature.properties!.id;
          const fare = data.fares[stId];
          const isSelectedSt = stId != selectedStation.id

          return {
            ...feature,
            properties: {
              ...feature.properties,
              fare: isSelectedSt ?
                (fare ? `${fare}円` : "情報なし") : "発駅",
            },
          };
        });

        setGeoStations({
          ...features,
          features: updatedFeatures,
        });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation?.id]);

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
          "text-field": selectedStation ?
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