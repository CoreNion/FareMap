"use client";

import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export const MainMap = () => {
  return (
    <Map
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
    </Map>
  );
};

const MAP_STYLE_URL =
  "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json";