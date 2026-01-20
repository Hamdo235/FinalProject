"use client";
import dynamic from "next/dynamic";

const WorldMapInner = dynamic(() => import("./WorldMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center text-gray-400 text-sm h-[400px] border rounded-lg">
      Chargement de la carte...
    </div>
  ),
});

interface WorldMapProps {
  height?: string;
  refreshInterval?: number;
}

export default function WorldMap({ height = "400px", refreshInterval = 6000 }: WorldMapProps) {
  return <WorldMapInner height={height} refreshInterval={refreshInterval} />;
}
