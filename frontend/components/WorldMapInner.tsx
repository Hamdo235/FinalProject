"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchMapPoints } from "@/lib/api";
import { MapPoint } from "@/types/api";

// Fix icones Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src || markerIcon2x,
  iconUrl: markerIcon.src || markerIcon,
  shadowUrl: markerShadow.src || markerShadow,
});

interface WorldMapInnerProps {
  height?: string;
  refreshInterval?: number;
}

const severities = ["high", "medium", "low"] as const;

export default function WorldMapInner({ height = "400px", refreshInterval = 6000 }: WorldMapInnerProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ high: boolean; medium: boolean; low: boolean }>({
    high: true,
    medium: true,
    low: true,
  });

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

  const center: [number, number] =
    points.length > 0 && points[0].lat !== undefined && points[0].lon !== undefined
      ? [points[0].lat, points[0].lon]
      : [48.8566, 2.3522];

  const filtered = useMemo(() => {
    return points.filter(
      (p) =>
        (p.severity === "high" && levels.high) ||
        (p.severity === "medium" && levels.medium) ||
        (p.severity === "low" && levels.low)
    );
  }, [points, levels]);

  const bounds = useMemo(() => {
    const coords = filtered
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
  }, [filtered]);

  const severityIcon = (sev: string) => {
    const color = sev === "high" ? "#ef4444" : sev === "medium" ? "#f59e0b" : "#22c55e";
    let html = "";
    if (sev === "high") {
      html = `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid ${color};filter:drop-shadow(0 0 6px ${color});"></div>`;
    } else if (sev === "medium") {
      html = `<div style="width:12px;height:12px;background:${color};box-shadow:0 0 10px ${color};border:1px solid rgba(0,0,0,0.3);"></div>`;
    } else {
      html = `<div style="width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color};border:1px solid rgba(0,0,0,0.3);"></div>`;
    }
    return L.divIcon({ html, className: "severity-marker", iconSize: [12, 12] });
  };

  const renderFilters = () => (
    <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur rounded shadow p-2 text-xs space-x-3">
      {severities.map((lvl) => (
        <label key={lvl} className="inline-flex items-center gap-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={levels[lvl]}
            onChange={(e) => setLevels((s) => ({ ...s, [lvl]: e.target.checked }))}
          />
          <span>{lvl}</span>
        </label>
      ))}
    </div>
  );

  const renderMarkers = () =>
    filtered.map((pt) =>
      pt.lat !== undefined && pt.lon !== undefined ? (
        <Marker key={pt.id} position={[pt.lat, pt.lon]} icon={severityIcon(pt.severity)}>
          <Popup>
            <div className="text-xs space-y-1">
              <div>
                <strong>IP:</strong> {pt.ip}
              </div>
              <div>
                <strong>Severite:</strong> {pt.severity}
              </div>
              {pt.ts && (
                <div>
                  <strong>Heure:</strong> {new Date(pt.ts).toLocaleString()}
                </div>
              )}
              <div className="pt-1">
                <a href="/alerts" className="text-blue-600 underline">
                  Voir les alertes
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ) : null
    );

  return (
    <div className="rounded-lg overflow-hidden border relative" style={{ height, width: "100%" }}>
      {renderFilters()}
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
      {bounds ? (
        <MapContainer bounds={bounds} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup chunkedLoading>{renderMarkers()}</MarkerClusterGroup>
        </MapContainer>
      ) : (
        <MapContainer center={center} zoom={2} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup chunkedLoading>{renderMarkers()}</MarkerClusterGroup>
        </MapContainer>
      )}
    </div>
  );
}
