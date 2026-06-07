"use client";
import React from "react";
import {
  Send, ArrowLeft, Plus, Bot, Pencil, Trash2, Copy, Square, Eye, Zap,
  Volume2, VolumeX, Mic, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { fetchAlerts } from "@/lib/api";
import type { Alert } from "@/types/api";
import { formatDateTimeLocal, parseApiDate, formatRelativeLocal } from "@/lib/time";

// Marker injecté dans le contenu pour détecter les cartes Vue d'ensemble
const OVERVIEW_MARKER = "__CS_OVERVIEW__";

// ── Composant de rendu des cartes alertes ──────────────────────────────────────
function OverviewCards({ raw }: { raw: string }) {
  let alerts: Alert[] = [];
  try { alerts = JSON.parse(raw); } catch { return <p className="text-accent-red">Données invalides.</p>; }

  const SEV_OV: Record<string, { card: string; badge: string; label: string }> = {
    high:   { card: "bg-[#2A1A12] border-[#4D3122]",  badge: "bg-[#2A1A12] border-[#4D3122] text-accent-terra", label: "CRITIQUE" },
    medium: { card: "bg-[#262017] border-[#4A3F1C]",  badge: "bg-[#262017] border-[#4A3F1C] text-[#E0B83A]",   label: "MOYENNE"  },
    low:    { card: "bg-[#15241C] border-[#2C4A39]",  badge: "bg-[#1C3025] border-[#2C4A39] text-accent-sage", label: "FAIBLE"   },
  };
  const ov = (s: string) => SEV_OV[s] ?? SEV_OV.low;
  const scoreColor = (v: number) => v > 0.8 ? "text-accent-terra" : v > 0.5 ? "text-[#E0B83A]" : "text-accent-sage";

  if (alerts.length === 0)
    return <p className="text-text-secondary">Aucune attaque détectée pour l&apos;instant.</p>;

  return (
    <div className="space-y-2 w-full">
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-3 font-mono-cyber text-accent-terra">
        {alerts.length} attaque{alerts.length > 1 ? "s" : ""} detectee{alerts.length > 1 ? "s" : ""} - donnees ML temps reel
      </div>
      {alerts.map((a, i) => (
        <div key={a.id} className={`rounded-xl p-3 border ${ov(a.severity).card}`}>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold font-mono-cyber w-5 text-center text-text-muted">#{i + 1}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono-cyber uppercase border ${ov(a.severity).badge}`}>
                {ov(a.severity).label}
              </span>
              <span className="text-xs font-mono-cyber text-text-mono">{a.ip || "IP inconnue"}</span>
            </div>
            <span className="text-[10px] font-mono-cyber text-text-muted">
              Score ML: <span className={scoreColor(a.score)}>{a.score.toFixed(3)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pl-7 text-text-secondary">
            <span>Règle: <span className="text-text-primary">{a.rule || a.source || "N/A"}</span></span>
            <span>Statut: <span className="text-text-primary">{a.status}</span></span>
            <span>Détectée: <span className="text-text-primary">{formatDateTimeLocal(a.ts)}</span></span>
          </div>
        </div>
      ))}
      <p className="text-[10px] mt-2 text-text-muted">
        Source: API /alerts · Modèle IsolationForest/LOF — aucune action automatique
      </p>
    </div>
  );
}

type Conversation = { id: number; title: string; created_at: string };
type ChatMessage  = {
  id: number; conversation_id: number;
  role: "user" | "assistant"; content: string; created_at: string;
};

export default function ChatPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  const [input, setInput]       = React.useState("");
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);
  const [convs, setConvs]       = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const esRef       = React.useRef<EventSource | null>(null);
  const bottomRef   = React.useRef<HTMLDivElement | null>(null);
  const recognitionRef           = React.useRef<any>(null);
  const voiceTranscriptRef       = React.useRef("");
  const isVoiceModeRef           = React.useRef(false);
  const voiceActiveIdRef         = React.useRef<number | null>(null);
  const startVoiceRecognitionRef = React.useRef<() => void>(() => {});
  const mediaStreamRef           = React.useRef<MediaStream | null>(null);
  const audioContextRef          = React.useRef<AudioContext | null>(null);
  const rafIdRef                 = React.useRef<number | null>(null);
  const forceProcessRef          = React.useRef(false);
  const voiceAudioQueueRef        = React.useRef<Blob[]>([]);
  const voiceTtsInFlightRef       = React.useRef(0);
  const voiceStreamDoneRef        = React.useRef(false);
  const voiceSentenceBufRef       = React.useRef("");
  const playbackCtxRef            = React.useRef<AudioContext | null>(null);
  const currentSourceRef          = React.useRef<AudioBufferSourceNode | null>(null);
  const voiceDecodingRef          = React.useRef(false);
  const [isListening,    setIsListening]    = React.useState(false);
  const [isVoiceMode,    setIsVoiceMode]    = React.useState(false);
  const [voiceStatus,    setVoiceStatus]    = React.useState<"listening" | "processing" | "speaking" | "idle">("idle");
  const [voiceTranscript,setVoiceTranscript] = React.useState("");
  const [speakingId, setSpeakingId] = React.useState<number | null>(null);
  const [autoSpeak,  setAutoSpeak]  = React.useState(false);

  const toSpeakable = (content: string): string => {
    if (content.startsWith(OVERVIEW_MARKER)) return "Vue d'ensemble des alertes affichée.";
    return content
      .replace(/```[\s\S]*?```/g, "bloc de code.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_~#>]+/g, "")
      .replace(/https?:\/\/\S+/g, "lien web")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();
  };

  const currentAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const stopSpeaking = React.useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    try { currentSourceRef.current?.stop(); } catch (_) {}
    currentSourceRef.current = null;
    setSpeakingId(null);
  }, []);

  const speakWithBackend = React.useCallback(async (
    text: string,
    onEnd: () => void,
  ) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    try {
      const res = await fetch(`${apiBase}/llm/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: "fr" }),
      });
      if (!res.ok) { onEnd(); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); currentAudioRef.current = null; onEnd(); };
      audio.onerror = () => { URL.revokeObjectURL(url); currentAudioRef.current = null; onEnd(); };
      await audio.play();
    } catch {
      onEnd();
    }
  }, []);

  const voicePlayNext = React.useCallback(async () => {
    if (voiceAudioQueueRef.current.length === 0) {
      if (voiceStreamDoneRef.current && voiceTtsInFlightRef.current === 0 &&
          !currentSourceRef.current && !voiceDecodingRef.current) {
        setSpeakingId(null);
        setVoiceStatus("idle");
        if (isVoiceModeRef.current) setTimeout(() => startVoiceRecognitionRef.current(), 500);
      }
      return;
    }
    const ctx = playbackCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    const blob = voiceAudioQueueRef.current.shift()!;
    voiceDecodingRef.current = true; // sentinel: decoding in progress
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const ab = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(ab);
      const source = ctx.createBufferSource();
      currentSourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        voiceDecodingRef.current = false;
        currentSourceRef.current = null;
        voicePlayNext();
      };
      source.start(0);
      voiceDecodingRef.current = false; // decoding done, playing now
    } catch {
      voiceDecodingRef.current = false;
      currentSourceRef.current = null;
      voicePlayNext();
    }
  }, []);

  const enqueueVoiceSentence = React.useCallback(async (text: string) => {
    if (!text.trim()) return;
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    voiceTtsInFlightRef.current += 1;
    try {
      const res = await fetch(`${apiBase}/llm/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: "fr" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        voiceAudioQueueRef.current.push(blob);
        if (!currentSourceRef.current && !voiceDecodingRef.current) voicePlayNext();
      }
    } catch { /* silent */ }
    voiceTtsInFlightRef.current -= 1;
    // Only restart if nothing is playing/decoding/queued (TTS failure path)
    if (voiceStreamDoneRef.current && voiceTtsInFlightRef.current === 0 &&
        voiceAudioQueueRef.current.length === 0 &&
        !currentSourceRef.current && !voiceDecodingRef.current) {
      setSpeakingId(null);
      setVoiceStatus("idle");
      if (isVoiceModeRef.current) setTimeout(() => startVoiceRecognitionRef.current(), 500);
    }
  }, [voicePlayNext]);

  const speak = React.useCallback((content: string, msgId: number) => {
    if (speakingId === msgId) { stopSpeaking(); return; }
    const text = toSpeakable(content);
    if (!text) return;
    stopSpeaking();
    setSpeakingId(msgId);
    speakWithBackend(text, () => setSpeakingId(null));
  }, [speakingId, stopSpeaking, speakWithBackend]);

  React.useEffect(() => () => { stopSpeaking(); }, [stopSpeaking]);

  const formatRelative = (iso: string) => {
    return formatRelativeLocal(iso);
  };

  const urlRegex = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;

  const Linkified: React.FC<{ text: string }> = ({ text }) => {
    const parts: (string | JSX.Element)[] = [];
    let last = 0;
    text.replace(urlRegex, (m, _g1, _g2, offset) => {
      if (offset > last) parts.push(text.slice(last, offset));
      const url = m.startsWith("http") ? m : `https://${m}`;
      parts.push(
        <a key={`${url}-${offset}`} href={url} target="_blank" rel="noreferrer"
          className="underline text-accent-sage hover:text-[#5CA37F]">{m}</a>
      );
      last = offset + m.length; return m;
    });
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
  };

  const InlineCode: React.FC<{ text: string }> = ({ text }) => {
    const tokens: (string | JSX.Element)[] = [];
    text.split(/`/).forEach((p, i) => {
      if (i % 2 === 1)
        tokens.push(
          <code key={i} className="px-1.5 py-0.5 rounded text-[0.85em] font-mono-cyber bg-[#13202C] text-accent-slate border border-[#2A4357]">
            {p}
          </code>
        );
      else if (p) tokens.push(<Linkified key={i} text={p} />);
    });
    return <>{tokens}</>;
  };

  const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
    <div className="relative my-2 group">
      <button
        onClick={async () => { try { await navigator.clipboard.writeText(code); } catch {} }}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded-lg font-mono-cyber opacity-0 group-hover:opacity-100 transition-opacity bg-[#13202C] text-accent-slate border border-[#2A4357]"
      >
        Copier
      </button>
      <pre className="overflow-auto rounded-xl p-4 text-xs font-mono-cyber bg-[#1C222B] text-accent-slate border border-[#262D38]">
        <code>{code}</code>
      </pre>
    </div>
  );

  const renderMsg = (content: string) => {
    // Vue d'ensemble: rendu carte dédié
    if (content.startsWith(OVERVIEW_MARKER)) {
      return <OverviewCards raw={content.slice(OVERVIEW_MARKER.length)} />;
    }
    const segs = content.split(/```[a-zA-Z0-9]*\n|```/);
    if (segs.length > 1) return (
      <div className="space-y-3">
        {segs.map((s, i) =>
          i % 2 === 1
            ? <CodeBlock key={i} code={s.replace(/\n$/, "")} />
            : (
              <div key={i} className="space-y-2">
                {s.split(/\n{2,}/).filter(Boolean).map((p, j) => (
                  <p key={j} className="leading-relaxed"><InlineCode text={p} /></p>
                ))}
              </div>
            )
        )}
      </div>
    );
    return (
      <div className="space-y-2">
        {content.split(/\n{2,}/).filter(Boolean).map((p, i) => (
          <p key={i} className="leading-relaxed"><InlineCode text={p} /></p>
        ))}
      </div>
    );
  };

  const loadConvs = React.useCallback(async () => {
    const r = await fetch(`${API}/llm/conversations`);
    if (!r.ok) throw new Error("Impossible de charger les conversations");
    const d: Conversation[] = await r.json();
    setConvs(d);
    if (d.length > 0 && activeId === null) setActiveId(d[0].id);
  }, [API, activeId]);

  const createConv = React.useCallback(async () => {
    const r = await fetch(`${API}/llm/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Session ${new Date().toLocaleString()}` }),
    });
    if (!r.ok) throw new Error("Impossible de créer");
    const c: Conversation = await r.json();
    setConvs((p) => [c, ...p]); setActiveId(c.id); setMessages([]);
  }, [API]);

  const renameConv = React.useCallback(async (id: number) => {
    const t = window.prompt("Nouveau titre:", convs.find((c) => c.id === id)?.title || "");
    if (!t) return;
    try {
      const r = await fetch(`${API}/llm/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!r.ok) throw new Error();
      const u: Conversation = await r.json();
      setConvs((p) => p.map((c) => (c.id === id ? u : c)));
    } catch { setError("Erreur renommage."); }
  }, [API, convs]);

  const deleteConv = React.useCallback(async (id: number) => {
    if (!window.confirm("Supprimer définitivement ?")) return;
    try {
      await fetch(`${API}/llm/conversations/${id}`, { method: "DELETE" });
      setConvs((p) => p.filter((c) => c.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch { setError("Erreur suppression."); }
  }, [API, activeId]);

  const copyLast = React.useCallback(async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) { try { await navigator.clipboard.writeText(last.content); } catch { setError("Impossible de copier."); } }
  }, [messages]);

  const stopStream = React.useCallback(() => {
    esRef.current?.close(); esRef.current = null; setLoading(false);
    setMessages((m) => m.filter((mm) => !(mm.role === "assistant" && mm.id === -1)));
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isOverview = (q: string) => {
    const lq = q.toLowerCase();
    const explicit = [
      "vue d'ensemble",
      "récapitulatif",
      "dernières attaques",
      "dernières alertes",
      "liste des alertes",
      "liste des incidents",
      "bilan des alertes",
      "bilan des attaques",
    ];
    return explicit.some((k) => lq.includes(k));
  };

  const loadMsgs = React.useCallback(async (id: number) => {
    const r = await fetch(`${API}/llm/conversations/${id}/messages`);
    if (!r.ok) throw new Error();
    setMessages(await r.json());
  }, [API]);

  const callAssistant = async (q: string, id: number) => {
    const r = await fetch(`${API}/llm/assistant/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, max_alerts: 8, max_incidents: 5 }),
    });
    if (!r.ok) throw new Error("Erreur assistant");
    const d = await r.json();
    const rr = await fetch(`${API}/llm/conversations/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "assistant", content: d.response, reply_with_llm: false }),
    });
    if (!rr.ok) throw new Error();
    const persistedAssistant: ChatMessage[] = await rr.json();
    setMessages((m) => [...m, ...persistedAssistant]);
  };

  const streamReply = (id: number) => {
    // Reset voice streaming state
    voiceAudioQueueRef.current = [];
    voiceTtsInFlightRef.current = 0;
    voiceStreamDoneRef.current = false;
    voiceSentenceBufRef.current = "";
    voiceDecodingRef.current = false;

    const voiceParam = isVoiceModeRef.current ? "?voice_mode=true" : "";
    const es = new EventSource(`${API}/llm/conversations/${id}/stream${voiceParam}`);
    esRef.current = es;
    let buf = "";
    // Remove any stale placeholder before adding a new one
    setMessages((m) => m.filter((x) => !(x.id === -1 && x.role === "assistant")));
    setMessages((m) => [...m, {
      id: -1, conversation_id: id, role: "assistant",
      content: "", created_at: new Date().toISOString(),
    }]);
    es.onmessage = (ev) => {
      buf += ev.data;
      setMessages((m) => {
        const c = [...m];
        const i = c.findIndex((x) => x.id === -1 && x.role === "assistant");
        if (i !== -1) c[i] = { ...c[i], content: buf } as ChatMessage;
        return c;
      });
      // ── Streaming TTS: fire TTS per sentence while LLM is generating ──
      if (isVoiceModeRef.current) {
        voiceSentenceBufRef.current += ev.data;
        const parts = voiceSentenceBufRef.current.split(/(?<=[.!?\n])\s+|\n{2,}/);
        if (parts.length > 1) {
          for (let i = 0; i < parts.length - 1; i++) {
            const s = toSpeakable(parts[i].trim());
            if (s) enqueueVoiceSentence(s);
          }
          voiceSentenceBufRef.current = parts[parts.length - 1];
        }
      }
    };
    es.addEventListener("done", () => {
      es.close(); esRef.current = null;
      loadMsgs(id).finally(() => {
        setLoading(false);
        if (isVoiceModeRef.current) {
          setVoiceStatus("speaking");
          // Flush remaining buffer
          const tail = toSpeakable(voiceSentenceBufRef.current.trim());
          if (tail) enqueueVoiceSentence(tail);
          voiceSentenceBufRef.current = "";
          voiceStreamDoneRef.current = true;
          // If nothing is pending at all, restart listening now
          if (voiceTtsInFlightRef.current === 0 && voiceAudioQueueRef.current.length === 0 &&
              !currentSourceRef.current && !voiceDecodingRef.current) {
            setSpeakingId(null);
            setVoiceStatus("idle");
            if (isVoiceModeRef.current) setTimeout(() => startVoiceRecognitionRef.current(), 500);
          }
        } else if (autoSpeak) {
          setMessages((m) => {
            const last = [...m].reverse().find((x) => x.role === "assistant" && x.id !== -1);
            if (last) speak(last.content, last.id);
            return m;
          });
        }
      });
    });
    es.addEventListener("error", () => {
      es.close(); esRef.current = null; setLoading(false);
    });
  };

  const sendMsg = async (q: string, id: number) => {
    const r = await fetch(`${API}/llm/conversations/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: q, reply_with_llm: false }),
    });
    if (!r.ok) throw new Error("Erreur d'envoi");
    const persisted: ChatMessage[] = await r.json();
    setMessages((m) => [...m, ...persisted]);
    if (isOverview(q)) { await callAssistant(q, id); setLoading(false); }
    else streamReply(id);
  };

  // ── WAV encoder (no ffmpeg dependency) ───────────────────────────────────────
  const encodeWAV = (audioBuffer: AudioBuffer): Blob => {
    const samples = audioBuffer.getChannelData(0); // mono
    const sr = audioBuffer.sampleRate;
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buf);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true);
    ws(8, "WAVE"); ws(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, "data"); v.setUint32(40, samples.length * 2, true);
    let off = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
    }
    return new Blob([buf], { type: "audio/wav" });
  };

  const startVoiceRecognition = React.useCallback(() => {
    const convId = voiceActiveIdRef.current;
    if (convId == null || !isVoiceModeRef.current) return;
    if (recognitionRef.current !== null) return; // already recording

    voiceTranscriptRef.current = "";
    setVoiceTranscript("");
    setVoiceStatus("listening");

    const SILENCE_MS    = 1800;
    const SPEECH_THRESH = 8;    // Balanced: avoids background noise triggers

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (!isVoiceModeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        mediaStreamRef.current = stream;

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream);
        recognitionRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.start(100);
        setIsListening(true);

        let hasSpeech = false;
        let silenceStart = 0;

        // Safety: single 30s timeout set ONCE (not inside the loop)
        const safetyTimer = setTimeout(() => {
          if (recorder.state === "recording") {
            forceProcessRef.current = hasSpeech || chunks.length > 0;
            recorder.stop();
          }
        }, 30000);

        const vadLoop = () => {
          if (!isVoiceModeRef.current) return;
          analyser.getByteFrequencyData(freqData);
          const rms = freqData.reduce((a, b) => a + b, 0) / freqData.length;
          if (rms > SPEECH_THRESH) {
            hasSpeech = true;
            silenceStart = 0;
            setVoiceTranscript("…");
          } else if (hasSpeech) {
            if (silenceStart === 0) silenceStart = Date.now();
            if (Date.now() - silenceStart > SILENCE_MS) {
              clearTimeout(safetyTimer);
              recorder.stop();
              return;
            }
          }
          rafIdRef.current = requestAnimationFrame(vadLoop);
        };

        recorder.onstop = async () => {
          recognitionRef.current = null; // allow startVoiceRecognition to run again
          clearTimeout(safetyTimer);
          setIsListening(false);
          if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
          stream.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;

          const shouldProcess = hasSpeech || forceProcessRef.current;
          forceProcessRef.current = false;
          if (!isVoiceModeRef.current || !shouldProcess) {
            audioCtx.close().catch(() => {}); audioContextRef.current = null;
            if (isVoiceModeRef.current) setTimeout(() => startVoiceRecognitionRef.current(), 300);
            return;
          }

          setVoiceStatus("processing");
          setVoiceTranscript("");

          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          let wavBlob: Blob;
          try {
            const ab      = await blob.arrayBuffer();
            const decoded = await audioCtx.decodeAudioData(ab);
            // Resample to 16 kHz — matches Whisper's native rate, ~3x smaller file
            const TARGET_SR = 16000;
            const offCtx  = new OfflineAudioContext(
              1,
              Math.ceil(decoded.duration * TARGET_SR),
              TARGET_SR,
            );
            const src = offCtx.createBufferSource();
            src.buffer = decoded;
            src.connect(offCtx.destination);
            src.start(0);
            const resampled = await offCtx.startRendering();
            wavBlob = encodeWAV(resampled);
          } catch {
            wavBlob = blob;
          } finally {
            audioCtx.close().catch(() => {}); audioContextRef.current = null;
          }

          const form = new FormData();
          form.append("file", wavBlob, "audio.wav");
          const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
          try {
            const res = await fetch(`${apiBase}/llm/transcribe`, { method: "POST", body: form });
            if (!res.ok) throw new Error(`Transcription HTTP ${res.status}`);
            const { text } = await res.json() as { text: string };
            if (!text?.trim()) {
              if (isVoiceModeRef.current) setTimeout(() => startVoiceRecognitionRef.current(), 300);
              return;
            }
            setVoiceTranscript(text);
            setLoading(true); setError(null);
            await sendMsg(text, convId);
          } catch (err: any) {
            setError(err.message);
            setLoading(false);
            if (isVoiceModeRef.current) setTimeout(() => startVoiceRecognitionRef.current(), 700);
          }
        };

        rafIdRef.current = requestAnimationFrame(vadLoop);
      })
      .catch((err: any) => {
        setError(`Accès micro refusé : ${err.message}`);
        setVoiceStatus("idle");
      });
  }, [encodeWAV, sendMsg]);

  React.useEffect(() => { startVoiceRecognitionRef.current = startVoiceRecognition; }, [startVoiceRecognition]);

  const enterVoiceMode = React.useCallback(() => {
    if (activeId == null) { setError("Créez d'abord une session."); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Accès micro non disponible dans ce navigateur."); return;
    }
    isVoiceModeRef.current = true;
    voiceActiveIdRef.current = activeId;
    voiceTranscriptRef.current = "";
    // Create playback AudioContext during user gesture to bypass autoplay policy
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = new AudioContext();
    playbackCtxRef.current.resume().catch(() => {});
    setIsVoiceMode(true);
    setVoiceTranscript("");
    setVoiceStatus("listening");
    startVoiceRecognitionRef.current();
  }, [activeId]);

  const exitVoiceMode = React.useCallback(() => {
    isVoiceModeRef.current = false;
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    try { (recognitionRef.current as MediaRecorder)?.stop(); } catch (_) {}
    recognitionRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    try { currentSourceRef.current?.stop(); } catch (_) {} currentSourceRef.current = null;
    voiceDecodingRef.current = false;
    voiceAudioQueueRef.current = [];
    voiceTtsInFlightRef.current = 0;
    voiceStreamDoneRef.current = false;
    voiceSentenceBufRef.current = "";
    playbackCtxRef.current?.close().catch(() => {}); playbackCtxRef.current = null;
    setSpeakingId(null);
    setIsVoiceMode(false);
    setIsListening(false);
    setVoiceStatus("idle");
    voiceTranscriptRef.current = "";
    setVoiceTranscript("");
  }, []);

  const startListening = React.useCallback((convId: number | null) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Reconnaissance vocale non supportée — utilisez Chrome/Chromium.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = async (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      setIsListening(false);
      if (!transcript.trim() || convId == null) return;
      setInput("");
      setLoading(true);
      setError(null);
      try {
        await sendMsg(transcript, convId);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening, sendMsg]);

  const sendQuick = async (q: string) => {
    if (activeId == null) return;
    setLoading(true); setError(null);
    try { await sendMsg(q, activeId); } catch (e: any) { setError(e.message); setLoading(false); }
  };

  // Fetch les vraies alertes et les rend comme cartes — sans passer par le LLM
  const handleOverview = async () => {
    if (activeId == null) return;
    setLoading(true); setError(null);
    try {
      // 1. Récupérer les vraies alertes depuis l'API ML
      const all = await fetchAlerts();
      const top5 = all
        .slice()
        .sort((a, b) => parseApiDate(b.ts).getTime() - parseApiDate(a.ts).getTime())
        .slice(0, 5);

      // 2. Persister le message utilisateur
      const userQ = "Vue d'ensemble — 5 dernières attaques détectées par le ML";
      await fetch(`${API}/llm/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: userQ, reply_with_llm: false }),
      });
      setMessages((m) => [...m, {
        id: Date.now(), conversation_id: activeId,
        role: "user", content: userQ, created_at: new Date().toISOString(),
      }]);

      // 3. Construire le contenu avec le marker + données JSON
      const overviewContent = OVERVIEW_MARKER + JSON.stringify(top5);

      // 4. Persister la réponse assistant
      const r = await fetch(`${API}/llm/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: overviewContent, reply_with_llm: false }),
      });
      if (r.ok) {
        const saved: ChatMessage[] = await r.json();
        setMessages((m) => [...m, ...saved]);
      } else {
        // Afficher localement si la persistance échoue
        setMessages((m) => [...m, {
          id: Date.now() + 1, conversation_id: activeId,
          role: "assistant", content: overviewContent, created_at: new Date().toISOString(),
        }]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur vue d'ensemble");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadConvs().catch((e) => setError(e.message)); }, [loadConvs]);
  React.useEffect(() => {
    if (activeId != null) loadMsgs(activeId).catch((e) => setError(e.message));
  }, [activeId, loadMsgs]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || activeId == null) return;
    const q = input.trim(); setInput(""); setLoading(true); setError(null);
    try { await sendMsg(q, activeId); } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const QUICK = [
    "Vue d'ensemble : donne les 5 dernières attaques avec IP, règle, sévérité et une courte explication.",
    "Explique l'incident le plus récent en termes simples.",
    "Récapitulatif des alertes du jour.",
    "Quelles IPs ont le plus d'alertes associées ?",
  ];

  const lastAssistantMsg = React.useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.id !== -1 && !m.content.startsWith(OVERVIEW_MARKER));
    if (!last) return null;
    const clean = last.content.replace(/```[\s\S]*?```/g, "").replace(/[*_#`]/g, "").trim();
    return clean.length > 120 ? clean.slice(0, 118) + "…" : clean;
  }, [messages]);

  return (
    <div className="h-full flex overflow-hidden bg-bg-base text-text-primary">

      {/* ── Conversations sidebar ── */}
      <aside className="hidden md:flex md:w-60 flex-col shrink-0 bg-bg-card border-r border-bg-border">
        {/* Header */}
        <div className="p-3 flex items-center justify-between shrink-0 border-b border-bg-border">
          <span className="text-[10px] uppercase tracking-widest font-bold text-text-muted">Sessions</span>
          <button onClick={() => createConv().catch((e) => setError(e.message))}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold border transition-all border-[#2C4A39] text-accent-sage bg-[#15241C] hover:bg-[#1C3025]">
            <Plus className="h-3 w-3" /> Nouvelle
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {convs.length === 0 && (
            <div className="p-4 text-xs text-center text-text-muted">Aucune session.</div>
          )}
          <ul>
            {convs.map((c) => {
              const isActive = activeId === c.id;
              return (
                <li key={c.id} className="border-b border-bg-border">
                  <div className={`flex items-center gap-1.5 px-2 py-2 ${isActive ? "bg-[#15241C]" : ""}`}>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-accent-sage" />}
                    <button className={`flex-1 text-left text-xs truncate transition-all ${isActive ? "text-accent-sage font-semibold" : "text-text-secondary"}`}
                      onClick={() => setActiveId(c.id)}>
                      {c.title}
                    </button>
                    <button className="p-1 rounded-md hover:bg-[#15241C] transition-all shrink-0" onClick={() => renameConv(c.id)}>
                      <Pencil className="h-3 w-3 text-text-muted" />
                    </button>
                    <button className="p-1 rounded-md hover:bg-[#2A1A12] transition-all shrink-0" onClick={() => deleteConv(c.id)}>
                      <Trash2 className="h-3 w-3 text-text-muted" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <header className="px-4 py-3 flex items-center justify-between shrink-0 bg-bg-card border-b border-bg-border">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-accent-sage">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm text-text-primary">Console SOC IA</span>
              <span className="text-xs ml-2 text-text-muted">- sans action automatique</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setAutoSpeak((v) => { if (v) stopSpeaking(); return !v; }); }}
              title={autoSpeak ? "Desactiver la voix" : "Activer la voix auto"}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
                autoSpeak
                  ? "border-[#2C4A39] text-accent-sage bg-[#15241C]"
                  : "border-bg-border text-text-secondary bg-bg-base"
              }`}>
              {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {autoSpeak ? "Voix ON" : "Voix"}
            </button>
            <button disabled={loading || activeId == null} onClick={handleOverview}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40 border-[#2C4A39] text-accent-sage bg-[#15241C] hover:bg-[#1C3025]">
              <Eye className="h-3 w-3" /> Vue d&apos;ensemble
            </button>
            <button onClick={copyLast}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all border-bg-border text-text-secondary bg-bg-base hover:bg-bg-card">
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-5 space-y-4 min-h-0">
          {activeId == null && (
            <div className="text-sm text-center py-12 text-text-secondary">
              Sélectionnez ou créez une session pour commencer.
            </div>
          )}

          {activeId != null && messages.length === 0 && (
            <div className="py-8 max-w-2xl mx-auto w-full">
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-[#15241C] border border-[#2C4A39]">
                  <Zap className="h-7 w-7 text-accent-sage" />
                </div>
                <p className="text-sm text-text-secondary">
                  Démarrez l&apos;analyse. Je répondrai sans action automatique.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK.map((q) => (
                  <button key={q} disabled={loading} onClick={() => sendQuick(q)}
                    className="text-left p-3 rounded-xl text-xs border transition-all disabled:opacity-40 bg-bg-base border-bg-border text-text-secondary hover:bg-[#15241C] hover:border-[#2C4A39] hover:text-text-primary">
                    {q.length > 68 ? q.slice(0, 66) + "…" : q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-3 text-sm max-w-2xl mx-auto animate-fade-in",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {m.role === "assistant" && (
                <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-accent-sage">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`rounded-2xl px-4 py-3 max-w-xl break-words ${
                m.role === "user"
                  ? "bg-[#15241C] border border-[#2C4A39] text-text-primary"
                  : "bg-bg-card border border-bg-border text-text-secondary"
              }`}
              >
                {renderMsg(m.content)}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-mono-cyber opacity-30">
                    {formatRelative(m.created_at)}
                  </div>
                  {m.role === "assistant" && !m.content.startsWith(OVERVIEW_MARKER) && (
                    <button onClick={() => speak(m.content, m.id)}
                      title={speakingId === m.id ? "Arrêter" : "Écouter"}
                      className={`flex items-center justify-center h-5 w-5 rounded-lg transition-all opacity-40 hover:opacity-100 ${
                        speakingId === m.id ? "text-accent-sage" : "text-text-secondary"
                      }`}>
                      {speakingId === m.id
                        ? <VolumeX className="h-3 w-3" />
                        : <Volume2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
              {m.role === "user" && (
                <div className="shrink-0 h-8 px-2.5 rounded-xl flex items-center bg-[#15241C] border border-[#2C4A39]">
                  <span className="text-xs font-bold font-mono-cyber text-accent-sage">moi</span>
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {loading && (
            <div className="flex gap-3 text-sm justify-start max-w-2xl mx-auto">
              <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center animate-pulse bg-accent-sage">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-bg-card border border-bg-border">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent-sage"
                      style={{ animation: `pulseLive 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span className="text-sm text-text-secondary">LLM analyse…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="fixed right-4 bottom-20 z-50">
              <div className="text-sm px-4 py-3 rounded-xl flex items-center gap-3 bg-[#2A1A12] border border-[#4D3122] text-accent-terra">
                {error}
                <button onClick={() => setError(null)}
                  className="text-xs px-2 py-0.5 rounded-lg border border-[#4D3122]">
                  ✕
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={onSubmit}
          className="shrink-0 p-4 flex items-center gap-2 max-w-2xl mx-auto w-full border-t border-bg-border"
        >
          <input
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-mono-cyber bg-bg-card border border-bg-border text-text-primary focus:outline-none focus:border-[#2C4A39] focus:ring-1 focus:ring-[#2C4A39]/30 transition-all disabled:opacity-50"
            placeholder={activeId == null ? "Créez d'abord une session…" : "Message au SOC IA…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || activeId == null}
          />
          {/* Mic button */}
          <button
            type="button"
            disabled={loading || activeId == null}
            onClick={enterVoiceMode}
            title="Mode vocal — parler au SOC IA"
            className={`inline-flex items-center justify-center h-10 w-10 rounded-2xl border transition-all disabled:opacity-40 shrink-0 ${
              isListening
                ? "bg-[#2A1A12] border-[#4D3122] text-accent-terra"
                : "bg-bg-base border-bg-border text-text-secondary"
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>

          {loading ? (
            <button
              type="button"
              onClick={stopStream}
              className="inline-flex items-center gap-1.5 rounded-2xl text-sm px-4 py-2.5 font-semibold border transition-all bg-[#2A1A12] border-[#4D3122] text-accent-terra"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || activeId == null}
              className="inline-flex items-center gap-1.5 rounded-2xl text-sm px-4 py-2.5 font-semibold transition-all disabled:opacity-40 bg-accent-sage text-white hover:bg-[#5CA37F] active:scale-[0.98]"
            >
              <Send className="h-4 w-4" /> Envoyer
            </button>
          )}
        </form>
      </div>

      {/* ── Voice Mode Overlay ── */}
      {isVoiceMode && (
        <>
          <style>{`
            @keyframes voiceOrbBreath {
              0%, 100% { transform: scale(1); }
              50%       { transform: scale(1.04); }
            }
            @keyframes voiceRing1 {
              0%   { transform: scale(0.95); opacity: 0.7; }
              100% { transform: scale(2.0);  opacity: 0; }
            }
            @keyframes voiceRing2 {
              0%   { transform: scale(0.95); opacity: 0.45; }
              100% { transform: scale(2.8);  opacity: 0; }
            }
            @keyframes voiceRing3 {
              0%   { transform: scale(0.95); opacity: 0.25; }
              100% { transform: scale(3.6);  opacity: 0; }
            }
            @keyframes voiceSpinCW  { to { transform: rotate(360deg);  } }
            @keyframes voiceSpinCCW { to { transform: rotate(-360deg); } }
            @keyframes voiceWave {
              0%, 100% { transform: scaleY(0.15); }
              50%       { transform: scaleY(1); }
            }
            @keyframes voiceIdleFloat {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-5px); }
            }
            @keyframes voiceGlow {
              0%, 100% { opacity: 0.7; }
              50%       { opacity: 1; }
            }
            @keyframes voiceTextIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes voiceCardIn {
              from { opacity: 0; transform: translateY(16px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes voiceScan {
              0%   { transform: translateY(-100%); opacity: 0; }
              10%  { opacity: 0.4; }
              90%  { opacity: 0.4; }
              100% { transform: translateY(100vh); opacity: 0; }
            }
          `}</style>

          {/* ── Full-screen overlay ── */}
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden"
            style={{ background: "linear-gradient(160deg, #0D1117 0%, #0D1117 50%, #0D1117 100%)" }}
          >
            {/* Hex grid */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.055,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='56' height='48' viewBox='0 0 56 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 0 L56 16 L56 32 L28 48 L0 32 L0 16Z' fill='none' stroke='%2322d3ee' stroke-width='0.6'/%3E%3C/svg%3E")`,
              backgroundSize: "56px 48px",
            }} />

            {/* Ambient glow behind orb */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background:
                voiceStatus === "listening"
                  ? "radial-gradient(ellipse 36% 32% at 50% 46%, rgba(239,68,68,0.14) 0%, transparent 70%)"
                  : voiceStatus === "speaking"
                  ? "radial-gradient(ellipse 36% 32% at 50% 46%, rgba(34,211,238,0.11) 0%, transparent 70%)"
                  : voiceStatus === "processing"
                  ? "radial-gradient(ellipse 36% 32% at 50% 46%, rgba(245,158,11,0.1) 0%, transparent 70%)"
                  : "none",
              transition: "background 0.9s ease",
              animation: "voiceGlow 3.5s ease-in-out infinite",
            }} />

            {/* Vignette */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, #0D1117 100%)",
            }} />

            {/* Scan line — speaking only */}
            {voiceStatus === "speaking" && (
              <div style={{
                position: "absolute", left: 0, right: 0, height: 2, pointerEvents: "none",
                background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.35), transparent)",
                animation: "voiceScan 4s linear infinite",
              }} />
            )}

            {/* ── Top bar ── */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: voiceStatus === "idle" ? "#1C222B"
                    : voiceStatus === "listening"  ? "#D98862"
                    : voiceStatus === "speaking"   ? "#6BA3C9"
                    : "#E8C547",
                  boxShadow: voiceStatus !== "idle" ? `0 0 10px ${voiceStatus === "listening" ? "#D98862" : voiceStatus === "speaking" ? "#6BA3C9" : "#E8C547"}` : "none",
                  animation: voiceStatus !== "idle" ? "voiceGlow 1.4s ease-in-out infinite" : "none",
                }} />
                <span style={{ color: "#1A2C3A", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.22em", textTransform: "uppercase" }}>
                  CyberSentinel &nbsp;·&nbsp; Mode Vocal
                </span>
              </div>
              <button onClick={exitVoiceMode}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/[0.08] text-text-muted bg-black/50 backdrop-blur-md hover:border-white/25 hover:text-text-secondary transition-all cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Status chip ── */}
            <div style={{ marginBottom: 36, animation: "voiceTextIn 0.3s ease-out" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 18px", borderRadius: 999,
                background: voiceStatus === "idle" ? "rgba(15,23,42,0.5)"
                  : voiceStatus === "listening"  ? "rgba(239,68,68,0.08)"
                  : voiceStatus === "speaking"   ? "rgba(34,211,238,0.07)"
                  : "rgba(245,158,11,0.07)",
                border: `1px solid ${
                  voiceStatus === "idle"       ? "rgba(30,58,74,0.3)"
                  : voiceStatus === "listening"  ? "rgba(239,68,68,0.25)"
                  : voiceStatus === "speaking"   ? "rgba(34,211,238,0.22)"
                  : "rgba(245,158,11,0.22)"
                }`,
                backdropFilter: "blur(8px)",
                transition: "all 0.5s ease",
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: voiceStatus === "idle" ? "#1C222B"
                    : voiceStatus === "listening"  ? "#D98862"
                    : voiceStatus === "speaking"   ? "#6BA3C9"
                    : "#E8C547",
                  animation: voiceStatus !== "idle" ? "voiceGlow 1s ease-in-out infinite" : "none",
                }} />
                <span style={{
                  fontSize: 10, fontFamily: "monospace", letterSpacing: "0.3em",
                  textTransform: "uppercase", fontWeight: 700,
                  color: voiceStatus === "idle" ? "#1A2C3A"
                    : voiceStatus === "listening"  ? "#D98862"
                    : voiceStatus === "speaking"   ? "#6BA3C9"
                    : "#E8C547",
                }}>
                  {voiceStatus === "listening"  ? "En écoute"
                   : voiceStatus === "processing" ? "Traitement…"
                   : voiceStatus === "speaking"   ? "Assistant parle"
                   : "Prêt"}
                </span>
              </div>
            </div>

            {/* ── Orb container ── */}
            <div style={{ position: "relative", width: 230, height: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>

              {/* Ripple rings */}
              {(voiceStatus === "listening" || voiceStatus === "speaking") && (<>
                {[0, 0.75, 1.5].map((delay, i) => (
                  <div key={i} style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: `${i === 0 ? 1.5 : 1}px solid ${
                      voiceStatus === "listening"
                        ? `rgba(239,68,68,${[0.55,0.35,0.2][i]})`
                        : `rgba(34,211,238,${[0.5,0.3,0.18][i]})`
                    }`,
                    animation: `voiceRing${i+1} 2.4s ease-out ${delay}s infinite`,
                  }} />
                ))}
              </>)}

              {/* Processing arcs */}
              {voiceStatus === "processing" && (<>
                <div style={{
                  position: "absolute", inset: -12, borderRadius: "50%",
                  border: "2px solid transparent",
                  borderTopColor: "#E8C547", borderRightColor: "rgba(245,158,11,0.2)",
                  animation: "voiceSpinCW 1s linear infinite",
                }} />
                <div style={{
                  position: "absolute", inset: -24, borderRadius: "50%",
                  border: "1px solid transparent",
                  borderBottomColor: "rgba(245,158,11,0.35)", borderLeftColor: "rgba(245,158,11,0.12)",
                  animation: "voiceSpinCCW 1.7s linear infinite",
                }} />
                <div style={{
                  position: "absolute", inset: -38, borderRadius: "50%",
                  border: "1px solid transparent",
                  borderTopColor: "rgba(245,158,11,0.15)",
                  animation: "voiceSpinCW 2.8s linear infinite",
                }} />
              </>)}

              {/* Outer static ring */}
              <div style={{
                position: "absolute", inset: -8, borderRadius: "50%",
                border: `1px solid ${
                  voiceStatus === "idle"       ? "rgba(30,58,74,0.25)"
                  : voiceStatus === "listening"  ? "rgba(239,68,68,0.15)"
                  : voiceStatus === "speaking"   ? "rgba(34,211,238,0.14)"
                  : "rgba(245,158,11,0.14)"
                }`,
                transition: "border-color 0.6s ease",
              }} />

              {/* ── Main sphere ── */}
              <div
                onClick={() => {
                  if (voiceStatus === "listening") {
                    forceProcessRef.current = true;
                    (recognitionRef.current as MediaRecorder)?.stop();
                  }
                }}
                style={{
                  width: 210, height: 210, borderRadius: "50%",
                  position: "relative",
                  cursor: voiceStatus === "listening" ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background:
                    voiceStatus === "listening"
                      ? "radial-gradient(circle at 32% 28%, rgba(239,68,68,0.38) 0%, rgba(239,68,68,0.12) 40%, rgba(1,12,26,0.97) 100%)"
                      : voiceStatus === "speaking"
                      ? "radial-gradient(circle at 32% 28%, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.09) 40%, rgba(1,12,26,0.97) 100%)"
                      : voiceStatus === "processing"
                      ? "radial-gradient(circle at 32% 28%, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.07) 40%, rgba(1,12,26,0.97) 100%)"
                      : "radial-gradient(circle at 32% 28%, rgba(20,40,60,0.6) 0%, rgba(10,20,36,0.4) 45%, rgba(1,12,26,0.98) 100%)",
                  border: `1.5px solid ${
                    voiceStatus === "listening"  ? "rgba(239,68,68,0.45)"
                    : voiceStatus === "speaking" ? "rgba(34,211,238,0.4)"
                    : voiceStatus === "processing" ? "rgba(245,158,11,0.38)"
                    : "rgba(20,40,60,0.4)"
                  }`,
                  boxShadow:
                    voiceStatus === "listening"
                      ? "0 0 60px rgba(239,68,68,0.2), 0 0 120px rgba(239,68,68,0.07), inset 0 1px 0 rgba(239,68,68,0.2), inset 0 0 40px rgba(239,68,68,0.05)"
                      : voiceStatus === "speaking"
                      ? "0 0 60px rgba(34,211,238,0.18), 0 0 120px rgba(34,211,238,0.06), inset 0 1px 0 rgba(34,211,238,0.18), inset 0 0 40px rgba(34,211,238,0.04)"
                      : voiceStatus === "processing"
                      ? "0 0 50px rgba(245,158,11,0.14), inset 0 1px 0 rgba(245,158,11,0.15)"
                      : "0 0 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(20,40,60,0.2)",
                  animation:
                    voiceStatus === "listening" || voiceStatus === "speaking"
                      ? "voiceOrbBreath 2.8s ease-in-out infinite"
                      : voiceStatus === "idle"
                      ? "voiceIdleFloat 5s ease-in-out infinite"
                      : "none",
                  transition: "background 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease",
                }}
              >
                {/* Glass highlight top-left */}
                <div style={{
                  position: "absolute", top: "10%", left: "14%",
                  width: "38%", height: "26%", borderRadius: "50%",
                  background:
                    voiceStatus === "listening"  ? "radial-gradient(ellipse, rgba(255,160,160,0.14) 0%, transparent 100%)"
                    : voiceStatus === "speaking" ? "radial-gradient(ellipse, rgba(180,240,255,0.12) 0%, transparent 100%)"
                    : voiceStatus === "processing" ? "radial-gradient(ellipse, rgba(255,220,100,0.1) 0%, transparent 100%)"
                    : "radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 100%)",
                  pointerEvents: "none",
                  transition: "background 0.7s ease",
                }} />
                {/* Bottom rim reflection */}
                <div style={{
                  position: "absolute", bottom: "12%", right: "14%",
                  width: "28%", height: "12%", borderRadius: "50%",
                  background: voiceStatus === "idle" ? "none"
                    : voiceStatus === "listening"  ? "radial-gradient(ellipse, rgba(239,68,68,0.1) 0%, transparent 100%)"
                    : voiceStatus === "speaking"   ? "radial-gradient(ellipse, rgba(34,211,238,0.08) 0%, transparent 100%)"
                    : "radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 100%)",
                  pointerEvents: "none",
                }} />
                {/* Icon */}
                {voiceStatus === "listening" ? (
                  <Mic style={{ width: 72, height: 72, color: "#D98862", filter: "drop-shadow(0 0 20px rgba(239,68,68,0.65))" }} />
                ) : voiceStatus === "speaking" ? (
                  <Volume2 style={{ width: 72, height: 72, color: "#6BA3C9", filter: "drop-shadow(0 0 20px rgba(34,211,238,0.65))" }} />
                ) : voiceStatus === "processing" ? (
                  <Bot style={{ width: 72, height: 72, color: "#E8C547", filter: "drop-shadow(0 0 16px rgba(245,158,11,0.55))" }} />
                ) : (
                  <Mic style={{ width: 72, height: 72, color: "#1A2C3A" }} />
                )}
              </div>
            </div>

            {/* ── Equalizer / idle dots ── */}
            <div style={{ height: 60, marginTop: 28, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, paddingBottom: 4 }}>
              {voiceStatus === "speaking"
                ? [14,22,38,30,52,44,56,48,60,52,44,36,54,46,58,40,52,44,36,28,42,34,48,30,22,38,26,18].map((maxH, i) => (
                    <div key={i} style={{
                      width: 3, borderRadius: 2,
                      height: `${maxH}px`,
                      background: `linear-gradient(to top, rgba(34,211,238,${0.7 + (maxH / 60) * 0.3}), rgba(34,211,238,0.25))`,
                      transformOrigin: "center bottom",
                      animation: `voiceWave ${0.5 + (i % 7) * 0.08}s ease-in-out ${i * 0.04}s infinite`,
                      boxShadow: maxH > 45 ? "0 0 5px rgba(34,211,238,0.5)" : "none",
                    }} />
                  ))
                : voiceStatus === "listening"
                ? [8,14,10,18,12,16,10,14,8,18,12,10,16,8,12,14,10,18,8,14,12,16,10,14,8,12,10,14].map((h, i) => (
                    <div key={i} style={{
                      width: 3, borderRadius: 2, height: `${h}px`,
                      background: "rgba(239,68,68,0.25)",
                      animation: `voiceWave ${0.8 + (i % 4) * 0.15}s ease-in-out ${i * 0.06}s infinite`,
                      transformOrigin: "center bottom",
                    }} />
                  ))
                : Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: "rgba(20,40,60,0.8)",
                    }} />
                  ))
              }
            </div>

            {/* ── Transcript ── */}
            <div style={{ marginTop: 24, maxWidth: 400, width: "100%", padding: "0 28px", textAlign: "center", minHeight: 56 }}>
              {voiceTranscript ? (
                <div className="rounded-[14px] px-[18px] py-[10px] bg-black/80 border border-accent-sage/15 backdrop-blur-xl"
                  style={{ animation: "voiceTextIn 0.3s ease-out" }}>
                  <p className="text-text-secondary text-[13px] font-mono italic leading-relaxed">
                    « {voiceTranscript} »
                  </p>
                </div>
              ) : (
                <p className="text-[11px] font-mono tracking-[0.05em] text-text-muted">
                  {voiceStatus === "listening"   ? "Parlez — cliquez sur l'orbe pour envoyer"
                   : voiceStatus === "processing" ? "Envoi au LLM local…"
                   : voiceStatus === "speaking"   ? "L'assistant répond — patientez"
                   : "Cliquez sur le micro pour commencer"}
                </p>
              )}
            </div>

            {/* ── Last assistant message preview ── */}
            {lastAssistantMsg && (
              <div style={{
                position: "absolute", bottom: 36, left: 0, right: 0,
                display: "flex", justifyContent: "center",
                padding: "0 32px",
                animation: "voiceCardIn 0.5s ease-out",
              }}>
                <div className="max-w-[460px] w-full rounded-[14px] px-4 py-[10px] bg-bg-base/75 border border-white/[0.06] backdrop-blur-xl">
                  <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-text-muted mb-1">Dernière réponse</p>
                  <p className="text-[12px] leading-relaxed italic text-text-muted">{lastAssistantMsg}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
