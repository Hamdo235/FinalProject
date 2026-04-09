"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { fetchMapPoints } from "@/lib/api";
import { MapPoint } from "@/types/api";
import { useSearchParams } from "next/navigation";
import type { Map as LeafletMap, CircleMarker } from "leaflet";

interface WorldMapInnerProps {
  height?: string;
  refreshInterval?: number;
}

export default function WorldMapInner({ height = "400px", refreshInterval = 6000 }: WorldMapInnerProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<CircleMarker[]>([]);
  const search = useSearchParams();
  const highlightIp = search?.get("ip") || "";

  // Initialize Leaflet map manually — avoids react-leaflet's MapContainer lifecycle issues
  // (double-init in Strict Mode). The `cancelled` flag ensures the async import
  // is a no-op if cleanup already fired before the promise resolved.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }
      ).addTo(map);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  // Sync markers whenever points or highlight changes
  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds: [number, number][] = [];

      for (const pt of points) {
        if (pt.lat == null || pt.lon == null) continue;
        const isHighlighted = !!highlightIp && pt.ip === highlightIp;
        const marker = L.circleMarker([pt.lat, pt.lon], {
          color: isHighlighted ? "#10b981" : "#22d3ee",
          weight: 2,
          fillColor: isHighlighted ? "#10b981" : "#3b82f6",
          fillOpacity: 0.85,
          radius: isHighlighted ? 9 : 6,
        })
          .bindPopup(
            `<div style="background:#0c1628;color:#e2e8f0;padding:6px 8px;border-radius:8px;font-size:12px">
              <div><strong style="color:#22d3ee">IP:</strong> ${pt.ip}</div>
              ${pt.country ? `<div><strong style="color:#22d3ee">Pays:</strong> ${pt.country}</div>` : ""}
              <div><strong style="color:#22d3ee">Alertes:</strong> ${pt.count}</div>
              <a href="/alerts" style="color:#67e8f9">Voir les alertes</a>
            </div>`
          )
          .addTo(mapRef.current!);

        markersRef.current.push(marker);
        bounds.push([pt.lat, pt.lon]);
      }

      if (bounds.length > 0) {
        try {
          mapRef.current.fitBounds(bounds as any, { padding: [20, 20], maxZoom: 6 });
        } catch (_) {}
      }
    });
  }, [points, highlightIp]);

  // Fetch points on mount and on interval
  useEffect(() => {
    const load = async () => {
      try {
        const pts = await fetchMapPoints();
        setPoints(pts);
        if (pts.length === 0) setError("Aucun point GeoIP — GeoLite2 non configuré ou aucune alerte.");
        else setError(null);
      } catch {
        setError("Impossible de joindre l'API /map/points.");
      } finally {
        setLoading(false);
      }
    };

    load();
    if (refreshInterval > 0) {
      const iv = setInterval(load, refreshInterval);
      return () => clearInterval(iv);
    }
  }, [refreshInterval]);

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{ height, width: "100%", border: "1px solid rgba(34,211,238,0.2)" }}
    >
      {loading && points.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm z-[500] font-mono-cyber"
          style={{ background: "rgba(8,15,26,0.85)", color: "#64748b" }}
        >
          Chargement…
        </div>
      )}
      {/* Erreur réseau */}
      {error && error.includes("API") && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm z-[500]"
          style={{ background: "rgba(8,15,26,0.92)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}
      {/* Pas de données GeoIP — placeholder info */}
      {!loading && !error?.includes("API") && points.length === 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-[500]"
          style={{ background: "rgba(8,15,26,0.97)" }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <p className="text-xs font-mono-cyber" style={{ color: "#475569" }}>GeoLite2 non configuré</p>
          <p className="text-[10px] font-mono-cyber" style={{ color: "#334155" }}>Définir GEOLITE2_CITY_DB dans .env pour activer la carte</p>
        </div>
      )}
      {/* Plain div — Leaflet initializes directly on this node */}
      <div ref={containerRef} style={{ height: "100%", width: "100%", visibility: points.length === 0 ? "hidden" : "visible" }} />
    </div>
  );
}
