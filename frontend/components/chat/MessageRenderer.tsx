"use client";
import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import OverviewCards from "./OverviewCards";
import { OVERVIEW_MARKER } from "./types";

const urlRegex = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;

function Linkified({ text }: { text: string }) {
  const parts: (string | React.JSX.Element)[] = [];
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
}

function InlineCode({ text }: { text: string }) {
  const tokens: (string | React.JSX.Element)[] = [];
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
}

function CodeBlock({ code }: { code: string }) {
  return (
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
}

export function renderMsg(content: string): React.JSX.Element {
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
}

interface MessageContentProps {
  content: string;
  createdAt: string;
  speakingId: number | null;
  msgId: number;
  formatRelative: (iso: string) => string;
  onSpeak: (content: string, id: number) => void;
}

export function MessageContent({ content, createdAt, speakingId, msgId, formatRelative, onSpeak }: MessageContentProps) {
  return (
    <>
      {renderMsg(content)}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono-cyber opacity-30">
          {formatRelative(createdAt)}
        </div>
        {!content.startsWith(OVERVIEW_MARKER) && (
          <button onClick={() => onSpeak(content, msgId)}
            title={speakingId === msgId ? "Arrêter" : "Écouter"}
            className={`flex items-center justify-center h-5 w-5 rounded-lg transition-all opacity-40 hover:opacity-100 ${
              speakingId === msgId ? "text-accent-sage" : "text-text-secondary"
            }`}>
            {speakingId === msgId
              ? <VolumeX className="h-3 w-3" />
              : <Volume2 className="h-3 w-3" />}
          </button>
        )}
      </div>
    </>
  );
}
