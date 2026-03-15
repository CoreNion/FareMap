"use client";

import Map, { GeolocateControl, FullscreenControl, NavigationControl, Layer, MapProvider, Popup, Source, useMap } from "react-map-gl/maplibre";
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
          zoom: 14,
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
        <FullscreenControl />
        <NavigationControl />
        <GeolocateControl />
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
    map.on("load", () => {
      map.setGlyphs("https://mierune.github.io/fonts/{fontstack}/{range}.pbf");
      (async () => {
        if (!map.hasImage("station")) {
          const stIcon = await map.loadImage("icons/station.png");
          map.addImage("station", stIcon.data);
        }

        const response = await fetch(STATIONS_GEOJSON_URL);
        const data = await response.json() as GeoJSON.GeoJSON;
        setGeoStations(data);
      }
      )();
    });

    map.on("click", "stations", (e) => {
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
    });

    map.on('mouseenter', 'stations', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'stations', () => {
        map.getCanvas().style.cursor = '';
    });
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
          return {
            ...feature,
            properties: {
              ...feature.properties,
              fare: stId != selectedStation.id ?
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
          "icon-size": 0.1,
          "text-font": ["mplus2p-regular"],
          "text-size": 16,
          "text-field": selectedStation ?
            [
              "format",
              ["get", "name"], { "text-color": "#555" }, "\n", {},
              ["get", "fare"], { "font-scale": 1.2, 'text-font': ['literal', ['mplus2p-medium']] }
            ] :
            ["get", "name"],
          'text-anchor': 'top',
          'text-offset': [0, 2],
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
                setSelectedStation({
                  id: popUpOptions!.feature.properties!.id,
                  name: popUpOptions!.feature.properties!.name,
                });
                setShowPopup(false);
              }}>当駅からの運賃を表示</button>
              : <span className="text-xs">当駅からの運賃を表示中</span>
            }
          </div>
        </Popup>
      }
    </Source>
  ) : <></>;
}