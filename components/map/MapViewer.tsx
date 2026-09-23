"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { ComponentProps } from "react";
import "leaflet/dist/leaflet.css";

type GeoJSONData = ComponentProps<typeof GeoJSON>["data"];

export default function MapViewer() {
  // Se reemplaza 'any' por la interfaz correcta de GeoJSON
  const [geojsonData, setGeojsonData] = useState<GeoJSONData | null>(null);

  useEffect(() => {
    fetch("/streets-atlixco.json")
      .then((res) => res.json())
      .then((data: GeoJSONData) => setGeojsonData(data))
      .catch((err) => console.error("Error cargando GeoJSON:", err));
  }, []);

  return (
    // Estilos migrados a Tailwind CSS (ocupa toda la pantalla)
    // El z-0 previene que el mapa se superponga sobre elementos flotantes de tu UI (como navbars)
    <div className="h-screen w-full relative z-0">
      <MapContainer
        center={[18.904, -98.434]} 
        zoom={14}
        // MapContainer acepta className para heredar el 100% del contenedor padre
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geojsonData && (
          <GeoJSON 
            data={geojsonData} 
            // Nota: Este style se mantiene como objeto porque Leaflet dibuja vectores SVG/Canvas.
            // Tailwind no funciona para estilizar las líneas internas del mapa de Leaflet.
            style={{
              color: "#3b82f6", 
              weight: 2,
              opacity: 0.5,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}