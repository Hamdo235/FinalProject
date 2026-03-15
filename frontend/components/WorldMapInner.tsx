"use client";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchMapPoints } from "@/lib/api";
import { MapPoint } from "@/types/api";
import { useSearchParams } from "next/navigation";

interface WorldMapInnerProps {
  height?: string;
  refreshInterval?: number;
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [map, bounds]);

  return null;
}

export default function WorldMapInner({ height = "400px", refreshInterval = 6000 }: WorldMapInnerProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const search = useSearchParams();
  const highlightIp = search?.get("ip") || "";

  const load = async () => {
    try {
      const data = await fetchMapPoints();
      setPoints(data);
    } catch (e) {
      setError("Impossible de charger les points GeoIP.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (refreshInterval > 0) {
      const iv = setInterval(load, refreshInterval);
      return () => clearInterval(iv);
    }
  }, [refreshInterval]);

  const center = useMemo<[number, number]>(() => {
    if (points.length > 0 && points[0].lat !== undefined && points[0].lon !== undefined) {
      return [points[0].lat, points[0].lon];
    }
    return [48.8566, 2.3522];
  }, [points]);

  const bounds = useMemo(() => {
    const coords = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => [p.lat as number, p.lon as number] as [number, number]);
    if (coords.length === 0) return null;
    let minLat = coords[0][0],
      maxLat = coords[0][0],
      minLon = coords[0][1],
      maxLon = coords[0][1];
    for (const [lat, lon] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ] as [[number, number], [number, number]];
  }, [points]);

  const renderMarkers = () =>
    points.map((pt) =>
      pt.lat !== undefined && pt.lon !== undefined ? (
        <CircleMarker
          key={pt.ip}
          center={[pt.lat, pt.lon]}
          radius={highlightIp && pt.ip === highlightIp ? 9 : 6}
          pathOptions={{
            color: highlightIp && pt.ip === highlightIp ? "#16a34a" : "#2563eb",
            weight: 2,
            fillColor: highlightIp && pt.ip === highlightIp ? "#22c55e" : "#60a5fa",
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <div>
                <strong>IP:</strong> {pt.ip}
              </div>
              {pt.country && (
                <div>
                  <strong>Pays:</strong> {pt.country}
                </div>
              )}
              <div>
                <strong>Alertes:</strong> {pt.count}
              </div>
              <div className="pt-1">
                <a href="/alerts" className="text-blue-600 underline">
                  Voir les alertes
                </a>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ) : null
    );

  return (
    <div className="rounded-lg overflow-hidden border relative" style={{ height, width: "100%" }}>
      {loading && points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white/60 z-[500]">
          Chargement...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-600 text-sm bg-white/60 z-[500]">
          {error}
        </div>
      )}
      <MapContainer center={center} zoom={2} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <FitBounds bounds={bounds} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {renderMarkers()}
      </MapContainer>
    </div>
  );
}
