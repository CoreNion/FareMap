"use client";

import Map, { Layer, MapProvider, Popup, Source, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { Feature } from "geojson";
import { useEffect, useState } from "react";

const MAP_STYLE_URL =
  "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json";

const STATIONS_GEOJSON_URL = "jre/map.geojson";

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
  const [showPopup, setShowPopup] = useState(false);
  const [popUpOptions, setPopUpOptions] = useState<{
    longitude: number;
    latitude: number;
    feature: Feature;
  } | null>(null);

  useEffect(() => {
    if (!map) return undefined;

    if (!map.hasImage("station")) {
      map.loadImage("/icons/station.png").then((image) => {
        map.addImage("station", image.data);
      });
    }

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

  return (
    <Source id="stations-source" type="geojson" data={STATIONS_GEOJSON_URL}>
      <Layer
        id="stations"
        type="symbol"
        source="stations-source"
        layout={{
          "icon-image": "station",
          "icon-size": 0.1,
          "icon-allow-overlap": true,
        }}
      />
      {
        showPopup && <Popup longitude={popUpOptions!.longitude} latitude={popUpOptions!.latitude} onClose={() => setShowPopup(false)}>
          <div className="popup">
            <h3>駅名: {popUpOptions!.feature.properties!.name}</h3>
            <p>ID: {popUpOptions!.feature.properties!.id}</p>
          </div>
        </Popup>
      }
    </Source>
  );
}