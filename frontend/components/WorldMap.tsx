"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export type MapPoint = {
  ip: string;
  country?: string;
  lat: number;
  lon: number;
  count: number;
};

export default function WorldMap() {
  const [points, setPoints] = useState<MapPoint[]>([]);

  const load = async () => {
    try {
      const data = await apiGet<MapPoint[]>("/map/points");
      setPoints(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full h-[480px]">
      <MapContainer center={[20, 0]} zoom={2} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={`${p.ip}-${p.lat}-${p.lon}`} position={[p.lat, p.lon]} icon={icon}>
            <Popup>
              <div className="text-sm">
                <div><b>IP:</b> {p.ip}</div>
                <div><b>Pays:</b> {p.country || "?"}</div>
                <div><b>Alertes:</b> {p.count}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
