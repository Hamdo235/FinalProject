"use client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Conversation } from "./types";

interface Props {
  convs: Conversation[];
  activeId: number | null;
  onSetActive: (id: number) => void;
  onCreateConv: () => void;
  onRenameConv: (id: number) => void;
  onDeleteConv: (id: number) => void;
}

export default function ConversationSidebar({
  convs, activeId, onSetActive, onCreateConv, onRenameConv, onDeleteConv,
}: Props) {
  return (
    <aside className="hidden md:flex md:w-60 flex-col shrink-0 bg-bg-card border-r border-bg-border">
      <div className="p-3 flex items-center justify-between shrink-0 border-b border-bg-border">
        <span className="text-[10px] uppercase tracking-widest font-bold text-text-muted">Sessions</span>
        <button onClick={onCreateConv}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold border transition-all border-[#2C4A39] text-accent-sage bg-[#15241C] hover:bg-[#1C3025]">
          <Plus className="h-3 w-3" /> Nouvelle
        </button>
      </div>

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
                  <button
                    className={`flex-1 text-left text-xs truncate transition-all ${isActive ? "text-accent-sage font-semibold" : "text-text-secondary"}`}
                    onClick={() => onSetActive(c.id)}>
                    {c.title}
                  </button>
                  <button className="p-1 rounded-md hover:bg-[#15241C] transition-all shrink-0"
                    onClick={() => onRenameConv(c.id)}>
                    <Pencil className="h-3 w-3 text-text-muted" />
                  </button>
                  <button className="p-1 rounded-md hover:bg-[#2A1A12] transition-all shrink-0"
                    onClick={() => onDeleteConv(c.id)}>
                    <Trash2 className="h-3 w-3 text-text-muted" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
