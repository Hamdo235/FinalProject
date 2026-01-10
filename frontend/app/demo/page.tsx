"use client";
import dynamic from "next/dynamic";
import { apiPost } from "@/lib/api";
import { useState } from "react";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function DemoPage() {
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [msg, setMsg] = useState<string>("");
  const call = async (path: string) => {
    setBusy(true);
    try {
      await apiPost(path, {});
      // Force remount of the map to trigger data reload
      setRefreshKey((k) => k + 1);
      setMsg(path.endsWith("generate") ? "Logs générés." : "Réinitialisation effectuée.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Demo</h1>
      <div className="flex gap-2">
        <button
          onClick={() => call("/demo/generate")}
          disabled={busy}
          className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50"
        >
          {busy ? "..." : "Générer logs"}
        </button>
        <button
          onClick={() => call("/demo/reset")}
          disabled={busy}
          className="px-3 py-1.5 rounded border"
        >
          {busy ? "..." : "Reset"}
        </button>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={busy}
          className="px-3 py-1.5 rounded border"
        >
          Rafraîchir carte
        </button>
      </div>
      {msg && <div className="text-sm text-green-700">{msg}</div>}
      <WorldMap key={refreshKey} />
    </main>
  );
}
