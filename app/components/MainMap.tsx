"use client";

import Map, { Layer, MapProvider, Popup, Source, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Feature } from "geojson";
import { useEffect, useState } from "react";

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
          longitude: 139.463101,
          latitude: 35.651521,
          zoom: 12,
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100vh",
          zIndex: -1,
        }}
        mapStyle={MAP_STYLE_URL}
      >
        <MapController />
      </Map>
    </MapProvider>
  );
};

const MapController = () => {
  const { current: map } = useMap();
  const [geoStations, setGeoStations] = useState<GeoJSON.GeoJSON | null>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popUpOptions, setPopUpOptions] = useState<{
    longitude: number;
    latitude: number;
    feature: Feature;
  } | null>(null);

  const [selectedStation, setSelectedStation] = useState<string | undefined>();

  useEffect(() => {
    if (!map) return undefined;

    (async () => {
      if (!map.hasImage("station")) {
        const stIcon = await map.loadImage("/icons/station.png");
        map.addImage("station", stIcon.data);
      }

      const response = await fetch(STATIONS_GEOJSON_URL);
      const data = await response.json() as GeoJSON.GeoJSON;
      setGeoStations(data);
    }
    )();

    map.on("click", "stations", (e) => {
      const coordinates = e.features![0].geometry.coordinates.slice();

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      setPopUpOptions({
        longitude: coordinates[0],
        latitude: coordinates[1],
        feature: e.features![0],
      });
      setShowPopup(true);
    });
  }, [map]);

  useEffect(() => {
    if (selectedStation) {
      (async () => {
        const response = await fetch(`data/jre/fare/table/${selectedStation}.json`);
        const data = await response.json() as FareTable;

        // 各駅の運賃をGeoJSONのプロパティに追加
        const features = geoStations as GeoJSON.FeatureCollection;
        const updatedFeatures = features.features.map((feature) => {
          const fare = data.fares[feature.properties!.id];
          return {
            ...feature,
            properties: {
              ...feature.properties,
              fare: fare ? `${fare}円` : "情報なし",
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
  }, [selectedStation]);

  return geoStations ? (
    <Source id="stations-source" type="geojson" data={geoStations}>
      <Layer
        id="stations"
        type="symbol"
        source="stations-source"
        layout={{
          "icon-image": "station",
          "icon-size": 0.1,
          "icon-allow-overlap": true,
          "text-field": selectedStation ?
            [
              "format",
              ["get", "name"], { "font-scale": 0.8, "text-color": "#555" }, "\n", {},
              ["get", "fare"],
            ] :
            ["get", "name"],
          'text-anchor': 'top',
          'text-offset': [0, 2],
        }}
      />
      {
        showPopup && <Popup longitude={popUpOptions!.longitude} latitude={popUpOptions!.latitude} onClose={() => setShowPopup(false)}>
          <div className="popup">
            <h3>駅名: {popUpOptions!.feature.properties!.name}</h3>
            <p>ID: {popUpOptions!.feature.properties!.id}</p>
            <button onClick={() => {
              setSelectedStation(popUpOptions!.feature.properties!.id);
            }}>この駅からの運賃を表示</button>
          </div>
        </Popup>
      }
    </Source>
  ) : <></>;
}