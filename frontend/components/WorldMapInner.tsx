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

export default function WorldMapInner({ height = "400px", refreshInterval = 6000 }: WorldMapInnerProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Marker key={pt.ip} position={[pt.lat, pt.lon]}>
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
        </Marker>
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
