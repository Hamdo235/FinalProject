"use client";
import { Bot, Mic, Volume2, X } from "lucide-react";

type VoiceStatus = "listening" | "processing" | "speaking" | "idle";

interface Props {
  voiceStatus: VoiceStatus;
  voiceTranscript: string;
  lastAssistantMsg: string | null;
  recognitionRef: React.MutableRefObject<MediaRecorder | null>;
  forceProcessRef: React.MutableRefObject<boolean>;
  onExit: () => void;
}

const STATUS_COLOR: Record<VoiceStatus, string> = {
  listening:  "#D98862",
  speaking:   "#6BA3C9",
  processing: "#E8C547",
  idle:       "#1A2C3A",
};

const VOICE_STYLES = `
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
`;

export default function VoiceModeOverlay({
  voiceStatus, voiceTranscript, lastAssistantMsg,
  recognitionRef, forceProcessRef, onExit,
}: Props) {
  const sc = STATUS_COLOR[voiceStatus];

  const orbBackground = {
    listening:  "radial-gradient(circle at 32% 28%, rgba(239,68,68,0.38) 0%, rgba(239,68,68,0.12) 40%, rgba(1,12,26,0.97) 100%)",
    speaking:   "radial-gradient(circle at 32% 28%, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.09) 40%, rgba(1,12,26,0.97) 100%)",
    processing: "radial-gradient(circle at 32% 28%, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.07) 40%, rgba(1,12,26,0.97) 100%)",
    idle:       "radial-gradient(circle at 32% 28%, rgba(20,40,60,0.6) 0%, rgba(10,20,36,0.4) 45%, rgba(1,12,26,0.98) 100%)",
  }[voiceStatus];

  const orbBorder = {
    listening:  "rgba(239,68,68,0.45)",
    speaking:   "rgba(34,211,238,0.4)",
    processing: "rgba(245,158,11,0.38)",
    idle:       "rgba(20,40,60,0.4)",
  }[voiceStatus];

  const orbShadow = {
    listening:  "0 0 60px rgba(239,68,68,0.2), 0 0 120px rgba(239,68,68,0.07), inset 0 1px 0 rgba(239,68,68,0.2), inset 0 0 40px rgba(239,68,68,0.05)",
    speaking:   "0 0 60px rgba(34,211,238,0.18), 0 0 120px rgba(34,211,238,0.06), inset 0 1px 0 rgba(34,211,238,0.18), inset 0 0 40px rgba(34,211,238,0.04)",
    processing: "0 0 50px rgba(245,158,11,0.14), inset 0 1px 0 rgba(245,158,11,0.15)",
    idle:       "0 0 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(20,40,60,0.2)",
  }[voiceStatus];

  const statusLabel = {
    listening:  "En écoute",
    processing: "Traitement…",
    speaking:   "Assistant parle",
    idle:       "Prêt",
  }[voiceStatus];

  const hintLabel = {
    listening:  "Parlez — cliquez sur l'orbe pour envoyer",
    processing: "Envoi au LLM local…",
    speaking:   "L'assistant répond — patientez",
    idle:       "Cliquez sur le micro pour commencer",
  }[voiceStatus];

  const ambientBg = {
    listening:  "radial-gradient(ellipse 36% 32% at 50% 46%, rgba(239,68,68,0.14) 0%, transparent 70%)",
    speaking:   "radial-gradient(ellipse 36% 32% at 50% 46%, rgba(34,211,238,0.11) 0%, transparent 70%)",
    processing: "radial-gradient(ellipse 36% 32% at 50% 46%, rgba(245,158,11,0.1) 0%, transparent 70%)",
    idle:       "none",
  }[voiceStatus];

  return (
    <>
      <style>{VOICE_STYLES}</style>
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

        {/* Ambient glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: ambientBg,
          transition: "background 0.9s ease",
          animation: "voiceGlow 3.5s ease-in-out infinite",
        }} />

        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, #0D1117 100%)",
        }} />

        {/* Scan line (speaking only) */}
        {voiceStatus === "speaking" && (
          <div style={{
            position: "absolute", left: 0, right: 0, height: 2, pointerEvents: "none",
            background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.35), transparent)",
            animation: "voiceScan 4s linear infinite",
          }} />
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: sc,
              boxShadow: voiceStatus !== "idle" ? `0 0 10px ${sc}` : "none",
              animation: voiceStatus !== "idle" ? "voiceGlow 1.4s ease-in-out infinite" : "none",
            }} />
            <span style={{ color: "#1A2C3A", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.22em", textTransform: "uppercase" }}>
              CyberSentinel &nbsp;·&nbsp; Mode Vocal
            </span>
          </div>
          <button onClick={onExit}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/[0.08] text-text-muted bg-black/50 backdrop-blur-md hover:border-white/25 hover:text-text-secondary transition-all cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status chip */}
        <div style={{ marginBottom: 36, animation: "voiceTextIn 0.3s ease-out" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 18px", borderRadius: 999,
            background: voiceStatus === "idle" ? "rgba(15,23,42,0.5)" : `rgba(0,0,0,0.08)`,
            border: `1px solid ${voiceStatus === "idle" ? "rgba(30,58,74,0.3)" : `${sc}40`}`,
            backdropFilter: "blur(8px)", transition: "all 0.5s ease",
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", background: sc,
              animation: voiceStatus !== "idle" ? "voiceGlow 1s ease-in-out infinite" : "none",
            }} />
            <span style={{
              fontSize: 10, fontFamily: "monospace", letterSpacing: "0.3em",
              textTransform: "uppercase", fontWeight: 700, color: sc,
            }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Orb container */}
        <div style={{ position: "relative", width: 230, height: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>

          {/* Ripple rings */}
          {(voiceStatus === "listening" || voiceStatus === "speaking") && (<>
            {[0, 0.75, 1.5].map((delay, i) => (
              <div key={i} style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `${i === 0 ? 1.5 : 1}px solid ${voiceStatus === "listening"
                  ? `rgba(239,68,68,${[0.55,0.35,0.2][i]})`
                  : `rgba(34,211,238,${[0.5,0.3,0.18][i]})`}`,
                animation: `voiceRing${i+1} 2.4s ease-out ${delay}s infinite`,
              }} />
            ))}
          </>)}

          {/* Processing arcs */}
          {voiceStatus === "processing" && (<>
            <div style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#E8C547", borderRightColor: "rgba(245,158,11,0.2)", animation: "voiceSpinCW 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: -24, borderRadius: "50%", border: "1px solid transparent", borderBottomColor: "rgba(245,158,11,0.35)", borderLeftColor: "rgba(245,158,11,0.12)", animation: "voiceSpinCCW 1.7s linear infinite" }} />
            <div style={{ position: "absolute", inset: -38, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "rgba(245,158,11,0.15)", animation: "voiceSpinCW 2.8s linear infinite" }} />
          </>)}

          {/* Outer static ring */}
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `1px solid ${voiceStatus === "idle" ? "rgba(30,58,74,0.25)" : `${sc}26`}`,
            transition: "border-color 0.6s ease",
          }} />

          {/* Main sphere */}
          <div
            onClick={() => {
              if (voiceStatus === "listening") {
                forceProcessRef.current = true;
                recognitionRef.current?.stop();
              }
            }}
            style={{
              width: 210, height: 210, borderRadius: "50%", position: "relative",
              cursor: voiceStatus === "listening" ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: orbBackground,
              border: `1.5px solid ${orbBorder}`,
              boxShadow: orbShadow,
              animation: voiceStatus === "listening" || voiceStatus === "speaking"
                ? "voiceOrbBreath 2.8s ease-in-out infinite"
                : voiceStatus === "idle" ? "voiceIdleFloat 5s ease-in-out infinite" : "none",
              transition: "background 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease",
            }}
          >
            {/* Glass highlight */}
            <div style={{
              position: "absolute", top: "10%", left: "14%", width: "38%", height: "26%", borderRadius: "50%",
              background: voiceStatus === "listening"  ? "radial-gradient(ellipse, rgba(255,160,160,0.14) 0%, transparent 100%)"
                : voiceStatus === "speaking"           ? "radial-gradient(ellipse, rgba(180,240,255,0.12) 0%, transparent 100%)"
                : voiceStatus === "processing"         ? "radial-gradient(ellipse, rgba(255,220,100,0.1) 0%, transparent 100%)"
                : "radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 100%)",
              pointerEvents: "none", transition: "background 0.7s ease",
            }} />

            {/* Icon */}
            {voiceStatus === "listening"  ? <Mic    style={{ width: 72, height: 72, color: "#D98862", filter: "drop-shadow(0 0 20px rgba(239,68,68,0.65))" }} />
            : voiceStatus === "speaking"  ? <Volume2 style={{ width: 72, height: 72, color: "#6BA3C9", filter: "drop-shadow(0 0 20px rgba(34,211,238,0.65))" }} />
            : voiceStatus === "processing"? <Bot    style={{ width: 72, height: 72, color: "#E8C547", filter: "drop-shadow(0 0 16px rgba(245,158,11,0.55))" }} />
            :                               <Mic    style={{ width: 72, height: 72, color: "#1A2C3A" }} />}
          </div>
        </div>

        {/* Equalizer bars */}
        <div style={{ height: 60, marginTop: 28, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, paddingBottom: 4 }}>
          {voiceStatus === "speaking"
            ? [14,22,38,30,52,44,56,48,60,52,44,36,54,46,58,40,52,44,36,28,42,34,48,30,22,38,26,18].map((maxH, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2, height: `${maxH}px`,
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
                <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(20,40,60,0.8)" }} />
              ))
          }
        </div>

        {/* Transcript */}
        <div style={{ marginTop: 24, maxWidth: 400, width: "100%", padding: "0 28px", textAlign: "center", minHeight: 56 }}>
          {voiceTranscript ? (
            <div className="rounded-[14px] px-[18px] py-[10px] bg-black/80 border border-accent-sage/15 backdrop-blur-xl"
              style={{ animation: "voiceTextIn 0.3s ease-out" }}>
              <p className="text-text-secondary text-[13px] font-mono italic leading-relaxed">« {voiceTranscript} »</p>
            </div>
          ) : (
            <p className="text-[11px] font-mono tracking-[0.05em] text-text-muted">{hintLabel}</p>
          )}
        </div>

        {/* Last assistant message preview */}
        {lastAssistantMsg && (
          <div style={{
            position: "absolute", bottom: 36, left: 0, right: 0,
            display: "flex", justifyContent: "center",
            padding: "0 32px", animation: "voiceCardIn 0.5s ease-out",
          }}>
            <div className="max-w-[460px] w-full rounded-[14px] px-4 py-[10px] bg-bg-base/75 border border-white/[0.06] backdrop-blur-xl">
              <p className="text-[9px] font-mono tracking-[0.2em] uppercase text-text-muted mb-1">Dernière réponse</p>
              <p className="text-[12px] leading-relaxed italic text-text-muted">{lastAssistantMsg}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
