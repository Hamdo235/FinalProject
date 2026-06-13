"use client";
import React from "react";
import {
  Send, ArrowLeft, Bot, Copy, Square, Eye, Zap,
  Volume2, VolumeX, Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { fetchAlerts } from "@/lib/api";
import { parseApiDate, formatRelativeLocal } from "@/lib/time";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import { MessageContent } from "@/components/chat/MessageRenderer";
import VoiceModeOverlay from "@/components/chat/VoiceModeOverlay";
import { OVERVIEW_MARKER } from "@/components/chat/types";
import type { Conversation, ChatMsg } from "@/components/chat/types";


export default function ChatPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  const [input, setInput]       = React.useState("");
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);
  const [convs, setConvs]       = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
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

  const formatRelative = formatRelativeLocal;

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
    const persistedAssistant: ChatMsg[] = await rr.json();
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
        if (i !== -1) c[i] = { ...c[i], content: buf } as ChatMsg;
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
    const persisted: ChatMsg[] = await r.json();
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
        const saved: ChatMsg[] = await r.json();
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
      <ConversationSidebar
        convs={convs}
        activeId={activeId}
        onSetActive={setActiveId}
        onCreateConv={() => createConv().catch((e) => setError(e.message))}
        onRenameConv={renameConv}
        onDeleteConv={deleteConv}
      />

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
                {m.role === "assistant"
                  ? <MessageContent
                      content={m.content}
                      createdAt={m.created_at}
                      speakingId={speakingId}
                      msgId={m.id}
                      formatRelative={formatRelative}
                      onSpeak={speak}
                    />
                  : <>{m.content}<div className="mt-2 text-[10px] font-mono-cyber opacity-30">{formatRelative(m.created_at)}</div></>
                }
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
        <VoiceModeOverlay
          voiceStatus={voiceStatus}
          voiceTranscript={voiceTranscript}
          lastAssistantMsg={lastAssistantMsg}
          recognitionRef={recognitionRef}
          forceProcessRef={forceProcessRef}
          onExit={exitVoiceMode}
        />
      )}

    </div>
  );
}
