"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { ComponentProps } from "react";
import citizenPin from "@/assets/ReportsPin/pinCiudadano.png";
import officialPin from "@/assets/ReportsPin/pinOficial.png";
import type { Feature, LineString, MultiLineString } from "geojson";
import "leaflet/dist/leaflet.css";

type GeoJSONData = ComponentProps<typeof GeoJSON>["data"];
type StreetSegment = Feature<LineString | MultiLineString>;

interface MapViewerProps {
  showCoverage: boolean;
}

interface MapReport {
  id: string;
  report_type: "CIUDADANO" | "OFICIAL";
  title: string;
  latitude: number;
  longitude: number;
  authorName: string;
  streetSegment: StreetSegment | null;
}

const REPORT_REFRESH_INTERVAL_MS = 5000;

const reportIcons = {
  CIUDADANO: L.icon({
    iconUrl: citizenPin.src,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  }),
  OFICIAL: L.icon({
    iconUrl: officialPin.src,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  }),
};

export default function MapViewer({ showCoverage }: MapViewerProps) {
  const [geojsonData, setGeojsonData] = useState<GeoJSONData | null>(null);
  const [reports, setReports] = useState<MapReport[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [isCoverageLoading, setIsCoverageLoading] = useState(false);

  useEffect(() => {
    if (!showCoverage) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadCoverage = async () => {
      setIsCoverageLoading(true);
      setCoverageError(null);
      try {
        const response = await fetch("/streets-atlixco.json", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("No se pudo cargar la cobertura del sistema.");
        }

        const data = (await response.json()) as GeoJSONData;
        if (isMounted) {
          setGeojsonData(data);
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setCoverageError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al cargar la cobertura del sistema."
          );
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setIsCoverageLoading(false);
        }
      }
    };

    void loadCoverage();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [showCoverage]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;
    const controller = new AbortController();

    const refreshReports = async () => {
      try {
        const response = await fetch("/reports", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar los reportes activos.");
        }

        const data = (await response.json()) as MapReport[];
        if (!Array.isArray(data)) {
          throw new Error("La respuesta de reportes tiene un formato inválido.");
        }

        if (isMounted) {
          setReports(data);
          setReportError(null);
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setReportError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al actualizar los reportes."
          );
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          timeoutId = window.setTimeout(
            () => void refreshReports(),
            REPORT_REFRESH_INTERVAL_MS
          );
        }
      }
    };

    void refreshReports();

    return () => {
      isMounted = false;
      controller.abort();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const mapMessage =
    reportError ??
    (showCoverage
      ? coverageError ?? (isCoverageLoading ? "Cargando cobertura del sistema..." : null)
      : null);

  return (
    <div className="relative z-0 h-screen w-full">
      {mapMessage && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute right-4 top-4 z-[1000] max-w-xs rounded-md bg-volcano-snow px-3 py-2 text-sm text-night-sky shadow-md"
        >
          {mapMessage}
        </div>
      )}
      <MapContainer
        center={[18.904, -98.434]}
        zoom={14}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showCoverage && geojsonData && (
          <GeoJSON
            data={geojsonData}
            style={{
              color: "#3b82f6",
              weight: 2,
              opacity: 0.5,
            }}
          />
        )}

        {reports.map(
          (report) =>
            report.streetSegment && (
              <GeoJSON
                key={`${report.report_type}-${report.id}-segment`}
                data={report.streetSegment}
                style={{
                  color: "var(--enphasis-red)",
                  weight: 6,
                  opacity: 0.9,
                }}
              />
            )
        )}

        {reports.map((report) => (
          <Marker
            key={`${report.report_type}-${report.id}`}
            position={[report.latitude, report.longitude]}
            icon={reportIcons[report.report_type]}
          >
            <Popup>
              <div>
                <h3 className="font-bold">{report.title}</h3>
                <p>Reportado por: {report.authorName}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
