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
        "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
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
        const sevColor = pt.severity === "high" ? "#C4714A" : pt.severity === "medium" ? "#E8C547" : "#5B8A6E";
        const markerColor = isHighlighted ? "#5B8A6E" : sevColor;
        const marker = L.circleMarker([pt.lat, pt.lon], {
          color: markerColor,
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 0.85,
          radius: isHighlighted ? 10 : 7,
        })
          .bindPopup(
            `<div style="background:#FFFFFF;color:#1A1A1A;padding:8px 10px;border-radius:10px;font-size:12px;border:1px solid #E8E5E0;box-shadow:0 4px 12px rgba(0,0,0,0.10)">
              <div><strong style="color:#5B8A6E">IP:</strong> ${pt.ip}</div>
              ${pt.country ? `<div><strong style="color:#5B8A6E">Pays:</strong> ${pt.country}</div>` : ""}
              <div><strong style="color:#5B8A6E">Alertes:</strong> ${pt.count}</div>
              <a href="/alerts" style="color:#4A7B9D">Voir les alertes</a>
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
      className="rounded-2xl overflow-hidden relative border border-bg-border shadow-card"
      style={{ height, width: "100%" }}
    >
      {loading && points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm z-[500] font-mono-cyber bg-bg-base/90 text-text-muted">
          Chargement…
        </div>
      )}
      {/* Erreur réseau */}
      {error && error.includes("API") && (
        <div className="absolute inset-0 flex items-center justify-center text-sm z-[500] bg-bg-base/95 text-accent-terra">
          {error}
        </div>
      )}
      {/* Pas de données GeoIP — placeholder info */}
      {!loading && !error?.includes("API") && points.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-[500] bg-bg-base/95">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <p className="text-xs font-mono-cyber text-text-secondary">Carte GeoIP en attente de données</p>
          <p className="text-[10px] font-mono-cyber text-text-muted">Lancez la démo ou générez des alertes pour afficher les points</p>
        </div>
      )}
      {/* Plain div — Leaflet initializes directly on this node */}
      <div ref={containerRef} style={{ height: "100%", width: "100%", visibility: points.length === 0 ? "hidden" : "visible" }} />
    </div>
  );
}
