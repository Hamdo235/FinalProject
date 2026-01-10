export type SSEHandler = (data: any) => void;

export function connectSSE(path: string, onData: SSEHandler): () => void {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  const es = new EventSource(`${base}${path}`);
  const listener = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data);
      onData(data);
    } catch {
      // ignore invalid JSON
    }
  };
  es.addEventListener("message", listener as any);
  es.addEventListener("error", () => {
    // connection errors are expected; browser will retry
  });
  return () => {
    es.removeEventListener("message", listener as any);
    es.close();
  };
}
