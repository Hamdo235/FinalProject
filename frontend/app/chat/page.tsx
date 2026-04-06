"use client";
import React from "react";
import { MessageCircle, Send, ArrowLeft, Plus, Bot, Pencil, Trash2, Copy, Square, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Conversation = { id: number; title: string; created_at: string };
type ChatMessage = { id: number; conversation_id: number; role: "user" | "assistant"; content: string; created_at: string };

export default function ChatPage() {
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [convs, setConvs] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const esRef = React.useRef<EventSource | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  // Utils: relative time (very simple FR)
  const formatRelative = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.max(0, Date.now() - d.getTime());
    const s = Math.floor(diff / 1000);
    if (s < 10) return "à l’instant";
    if (s < 60) return `il y a ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const dys = Math.floor(h / 24);
    return `il y a ${dys} j`;
  };

  // Lightweight Markdown: ```code``` blocks, `inline`, and links
  const urlRegex = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;

  const Linkified: React.FC<{ text: string }> = ({ text }) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    text.replace(urlRegex, (match: string, _g1: string, _g2: string, offset: number) => {
      if (offset > lastIndex) parts.push(text.slice(lastIndex, offset));
      const url = match.startsWith("http") ? match : `https://${match}`;
      parts.push(
        <a key={`${url}-${offset}`} href={url} target="_blank" rel="noreferrer" className="underline text-blue-600 hover:text-blue-700">
          {match}
        </a>
      );
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <>{parts}</>;
  };

  const InlineCodeified: React.FC<{ text: string }> = ({ text }) => {
    const tokens: (string | JSX.Element)[] = [];
    const parts = text.split(/`/);
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        tokens.push(
          <code key={`code-${i}`} className="px-1 py-0.5 rounded bg-gray-100 border text-[0.9em]">
            {p}
          </code>
        );
      } else if (p) {
        tokens.push(<Linkified key={`txt-${i}`} text={p} />);
      }
    });
    return <>{tokens}</>;
  };

  const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
      } catch {}
    };
    return (
      <div className="relative group">
        <button
          onClick={onCopy}
          title="Copier"
          className="absolute top-2 right-2 text-xs border rounded px-2 py-1 bg-white/80 hover:bg-white shadow-sm"
        >
          Copier
        </button>
        <pre className="overflow-auto bg-gray-900 text-gray-100 rounded-md p-3 text-xs">
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  const renderMessage = (content: string) => {
    // Split by fenced blocks
    const segments = content.split(/```[a-zA-Z0-9]*\n|```/);
    // If odd number > 1, odd indices are code
    if (segments.length > 1) {
      return (
        <div className="space-y-3">
          {segments.map((seg, i) => {
            const isCode = i % 2 === 1;
            if (isCode) return <CodeBlock key={`code-${i}`} code={seg.replace(/\n$/, "")} />;
            // paragraphs
            return (
              <div key={`p-${i}`} className="space-y-2">
                {seg
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((para, pi) => (
                    <p key={`para-${i}-${pi}`} className="leading-relaxed">
                      <InlineCodeified text={para} />
                    </p>
                  ))}
              </div>
            );
          })}
        </div>
      );
    }
    // Simple paragraph rendering
    return (
      <div className="space-y-2">
        {content
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p key={`para-${i}`} className="leading-relaxed">
              <InlineCodeified text={para} />
            </p>
          ))}
      </div>
    );
  };

  const loadConversations = React.useCallback(async () => {
    setError(null);
    const res = await fetch(`${API}/llm/conversations`);
    if (!res.ok) throw new Error("Impossible de charger les conversations");
    const data: Conversation[] = await res.json();
    setConvs(data);
    if (data.length > 0 && activeId === null) {
      setActiveId(data[0].id);
    }
  }, [API, activeId]);

  const createConversation = React.useCallback(async () => {
    setError(null);
    const title = `Conversation ${new Date().toLocaleString()}`;
    const res = await fetch(`${API}/llm/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Impossible de créer la conversation");
    const conv: Conversation = await res.json();
    setConvs((c) => [conv, ...c]);
    setActiveId(conv.id);
    setMessages([]);
  }, [API]);

  const renameConversation = React.useCallback(async (convId: number) => {
    const current = convs.find((c) => c.id === convId);
    const title = window.prompt("Nouveau titre de la conversation:", current?.title || "Conversation");
    if (!title) return;
    try {
      const res = await fetch(`${API}/llm/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Impossible de renommer la conversation");
      const updated: Conversation = await res.json();
      setConvs((list) => list.map((c) => (c.id === convId ? updated : c)));
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    }
  }, [API, convs]);

  const deleteConversation = React.useCallback(async (convId: number) => {
    if (!window.confirm("Supprimer définitivement cette conversation ?")) return;
    try {
      const res = await fetch(`${API}/llm/conversations/${convId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Impossible de supprimer la conversation");
      setConvs((list) => list.filter((c) => c.id !== convId));
      if (activeId === convId) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    }
  }, [API, activeId]);

  const copyLastAssistant = React.useCallback(async () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content || "");
    } catch (e) {
      setError("Impossible de copier la réponse.");
    }
  }, [messages]);

  const stopStreaming = React.useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setLoading(false);
    // Nettoyer un éventuel placeholder partiel
    setMessages((m) => m.filter((mm) => !(mm.role === "assistant" && mm.id === -1)));
  }, []);

  // Auto-scroll vers le bas lors de nouveaux messages ou changement d'état de chargement
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isOverviewQuestion = (q: string) => {
    const lower = q.toLowerCase();
    const kw = [
      "attaques", "incidents", "alertes", "récap", "récentes", "dernières", "ouvertes",
      "statut", "bilan", "vue d'ensemble", "overview", "what happened", "what's up",
      "what's new", "summary", "recap", "recent", "latest", "open", "status", "résumé"
    ];
    return kw.some(k => lower.includes(k));
  };

  const callAssistant = async (question: string, convId: number) => {
    const res = await fetch(`${API}/llm/assistant/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, max_alerts: 8, max_incidents: 5 }),
    });
    if (!res.ok) throw new Error("Erreur assistant");
    const data = await res.json();
    // stocker la réponse assistant
    const replyRes = await fetch(`${API}/llm/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "assistant", content: data.response, reply_with_llm: false }),
    });
    if (!replyRes.ok) throw new Error("Erreur stockage réponse");
    const saved: ChatMessage[] = await replyRes.json();
    setMessages((m) => [...m, ...saved]);
  };

  const sendQuick = async (question: string) => {
    if (activeId == null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/llm/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: question, reply_with_llm: false }),
      });
      if (!res.ok) throw new Error("Erreur d’envoi");
      const createdUser: ChatMessage[] = await res.json();
      setMessages((m) => [...m, ...createdUser]);

      if (isOverviewQuestion(question)) {
        await callAssistant(question, activeId);
        setLoading(false);
        return;
      }

      const es = new EventSource(`${API}/llm/conversations/${activeId}/stream`);
      esRef.current = es;
      let buffer = "";
      setMessages((m) => [
        ...m,
        { id: -1, conversation_id: activeId, role: "assistant", content: "", created_at: new Date().toISOString() },
      ]);
      es.onmessage = (ev) => {
        buffer += ev.data;
        setMessages((m) => {
          const copy = [...m];
          const idx = copy.findIndex((mm) => mm.id === -1 && mm.role === "assistant");
          if (idx !== -1) copy[idx] = { ...copy[idx], content: buffer } as ChatMessage;
          return copy;
        });
      };
      es.addEventListener("done", () => {
        es.close();
        esRef.current = null;
        loadMessages(activeId).finally(() => setLoading(false));
      });
      es.addEventListener("error", () => {
        es.close();
        esRef.current = null;
        setLoading(false);
      });
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
      setLoading(false);
    }
  };

  const loadMessages = React.useCallback(async (convId: number) => {
    setError(null);
    const res = await fetch(`${API}/llm/conversations/${convId}/messages`);
    if (!res.ok) throw new Error("Impossible de charger les messages");
    const data: ChatMessage[] = await res.json();
    setMessages(data);
  }, [API]);

  React.useEffect(() => {
    loadConversations().catch((e) => setError(e.message));
  }, [loadConversations]);

  React.useEffect(() => {
    if (activeId != null) {
      loadMessages(activeId).catch((e) => setError(e.message));
    }
  }, [activeId, loadMessages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || activeId == null) return;
    const question = input.trim();
    setInput("");
    setLoading(true);
    setError(null);
    try {
      // 1) stocker le message user sans demander la réponse immédiate
      const res = await fetch(`${API}/llm/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: question, reply_with_llm: false }),
      });
      if (!res.ok) throw new Error("Erreur d’envoi");
      const createdUser: ChatMessage[] = await res.json();
      setMessages((m) => [...m, ...createdUser]);

      // 2) choisir assistant outillé ou chat normal
      if (isOverviewQuestion(question)) {
        await callAssistant(question, activeId);
        setLoading(false);
        return;
      }

      // 3) ouvrir le flux SSE pour générer la réponse en streaming
      const es = new EventSource(`${API}/llm/conversations/${activeId}/stream`);
      esRef.current = es;
      let buffer = "";
      // ajouter un placeholder assistant
      setMessages((m) => [
        ...m,
        { id: -1, conversation_id: activeId, role: "assistant", content: "", created_at: new Date().toISOString() },
      ]);
      es.onmessage = (ev) => {
        // token textuel
        buffer += ev.data;
        setMessages((m) => {
          const copy = [...m];
          const idx = copy.findIndex((mm) => mm.id === -1 && mm.role === "assistant");
          if (idx !== -1) copy[idx] = { ...copy[idx], content: buffer } as ChatMessage;
          return copy;
        });
      };
      es.addEventListener("done", () => {
        es.close();
        esRef.current = null;
        // recharger pour obtenir l’ID final stocké
        loadMessages(activeId).finally(() => setLoading(false));
      });
      es.addEventListener("error", () => {
        es.close();
        esRef.current = null;
        setLoading(false);
      });
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-transparent text-slate-900 flex overflow-hidden">
      {/* Sidebar conversations */}
      <aside className="hidden md:flex md:w-72 bg-white/70 border-r border-slate-900/10 flex-col">
        <div className="p-3 border-b border-slate-900/10 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-slate-500">Conversations</span>
          <button
            onClick={() => createConversation().catch((e) => setError(e.message))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-900/20 px-2 py-1 text-xs hover:bg-slate-50 text-slate-700"
          >
            <Plus className="h-3 w-3" /> Nouvelle
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {convs.length === 0 && (
            <div className="p-3 text-xs text-slate-500">Aucune conversation. Créez-en une.</div>
          )}
          <ul className="text-sm">
            {convs.map((c) => (
              <li key={c.id}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-900/10 gap-2">
                  <button
                    className={cn(
                      "flex-1 text-left truncate",
                      activeId === c.id ? "text-slate-900" : "text-slate-600"
                    )}
                    onClick={() => setActiveId(c.id)}
                    title={c.title}
                  >
                    {c.title}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 rounded hover:bg-slate-100"
                      title="Renommer"
                      onClick={() => renameConversation(c.id)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-slate-100"
                      title="Supprimer"
                      onClick={() => deleteConversation(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 border-b border-slate-900/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-emerald-700" />
              </span>
              <span className="font-medium">Console SOC – aucune action automatique</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (activeId == null) return;
                const question = "Vue d'ensemble : donne les 5 dernières attaques avec IP, règle, sévérité et une courte explication.";
                setLoading(true);
                setError(null);
                try {
                  const res = await fetch(`${API}/llm/conversations/${activeId}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "user", content: question, reply_with_llm: false }),
                  });
                  if (!res.ok) throw new Error("Erreur d'envoi");
                  const createdUser: ChatMessage[] = await res.json();
                  setMessages((m) => [...m, ...createdUser]);
                  await callAssistant(question, activeId);
                } catch (e: any) {
                  setError(e.message || "Erreur inconnue");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || activeId == null}
              className="inline-flex items-center gap-1 text-xs border border-slate-900/20 px-2 py-1 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              <Eye className="h-3 w-3" /> Vue d'ensemble
            </button>
            <button onClick={copyLastAssistant} className="inline-flex items-center gap-1 text-xs border border-slate-900/20 px-2 py-1 rounded hover:bg-slate-50">
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-6 space-y-4 min-h-0">
          {activeId == null && (
            <div className="text-sm text-slate-500 text-center py-8">
              Sélectionnez une conversation ou créez-en une nouvelle.
            </div>
          )}
          {activeId != null && messages.length === 0 && (
            <div className="py-8 max-w-3xl mx-auto w-full">
              <div className="text-sm text-slate-500 text-center mb-4">
                Démarrez la discussion. Je répondrai naturellement, sans action automatique.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => sendQuick("Vue d'ensemble : donne les 5 dernières attaques avec IP, règle, sévérité et une courte explication.")}
                  className="text-left border border-slate-900/10 rounded p-3 bg-white/70 hover:bg-white"
                  disabled={loading}
                >
                  Vue d’ensemble des événements récents
                </button>
                <button
                  onClick={() => sendQuick("Explique l'incident le plus récent en termes simples.")}
                  className="text-left border border-slate-900/10 rounded p-3 bg-white/70 hover:bg-white"
                  disabled={loading}
                >
                  Expliquer l’incident le plus récent
                </button>
                <button
                  onClick={() => sendQuick("Fais-moi un bref récapitulatif des alertes aujourd’hui.")}
                  className="text-left border border-slate-900/10 rounded p-3 bg-white/70 hover:bg-white"
                  disabled={loading}
                >
                  Récapitulatif des alertes du jour
                </button>
                <button
                  onClick={() => sendQuick("Coucou, comment ça va ?")}
                  className="text-left border border-slate-900/10 rounded p-3 bg-white/70 hover:bg-white"
                  disabled={loading}
                >
                  Small talk
                </button>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-3 text-sm max-w-3xl mx-auto",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {m.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-emerald-700" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-lg px-4 py-2 max-w-2xl break-words",
                  m.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-white/80 border border-slate-900/10 text-slate-900 shadow-sm"
                )}
              >
                {renderMessage(m.content)}
                <div className={cn("mt-1 text-[11px] opacity-70", m.role === "user" ? "text-white/70" : "text-slate-500")}>{formatRelative(m.created_at)}</div>
              </div>
              {m.role === "user" && (
                <div className="flex-shrink-0 h-8 rounded-md bg-slate-200 px-2 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-700">moi</span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 text-sm justify-start max-w-3xl mx-auto">
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="bg-white/80 border border-slate-900/10 rounded-lg px-4 py-2 text-slate-500 shadow-sm">
                L’assistant réfléchit…
              </div>
            </div>
          )}
          {/* Toast d’erreur */}
          {error && (
            <div className="fixed right-4 bottom-16 z-50">
              <div className="bg-red-600 text-white text-sm px-3 py-2 rounded shadow-lg flex items-center gap-2">
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="text-white/90 hover:text-white text-xs border border-white/30 rounded px-1"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Formulaire */}
        <form
          onSubmit={onSubmit}
          className="shrink-0 bg-white/80 border-t border-slate-900/10 p-4 flex items-center gap-2 max-w-3xl mx-auto w-full"
        >
          <input
            className="flex-1 rounded-md border border-slate-900/20 bg-white text-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-slate-500"
            placeholder={activeId == null ? "Créez d’abord une conversation…" : "Discutez librement…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || activeId == null}
          />
          {loading ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="inline-flex items-center gap-1 rounded-md bg-red-500 text-white text-sm px-4 py-2 hover:bg-red-600 transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || activeId == null}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white text-sm px-4 py-2 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              Envoyer
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
