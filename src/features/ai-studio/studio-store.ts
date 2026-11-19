"use client";

import { create } from "zustand";
import type { AiProviderId, Blueprint } from "@/lib/domain/contracts/ai";
import type { AdCopyForm, CopyState } from "./ad-copy-model";
import type { IdeaDraft } from "./blueprint-model";

// Work in progress of the AI studio tabs (blueprint drafts per idea, the ad copy workbench), kept in memory for the
// session so switching Ideas / Blueprint / Ad copy / Negatives never loses edits. Nothing here is persisted.

export interface AiResultMeta {
  source: AiProviderId;
  model: string | null;
  fallbackReason?: string;
  warnings: string[];
}

export interface BlueprintSession {
  idea: IdeaDraft;
  /** the stored idea as generated (null for a blank idea) — unchanged ideas are referenced by id */
  original: IdeaDraft | null;
  finalUrl: string;
  generated?: Blueprint;
  blueprint?: Blueprint;
  meta?: AiResultMeta;
  /** launch checklist ticks by index */
  checked: Record<number, boolean>;
}

export interface AdCopySession {
  form: AdCopyForm;
  copy: CopyState | null;
  meta: AiResultMeta | null;
  gen: number;
}

interface StudioState {
  blueprints: Record<string, BlueprintSession>;
  adCopy: AdCopySession | null;
  putBlueprint: (key: string, s: BlueprintSession) => void;
  dropBlueprint: (key: string) => void;
  setAdCopy: (s: AdCopySession) => void;
}

export const useStudio = create<StudioState>((set) => ({
  blueprints: {},
  adCopy: null,
  putBlueprint: (key, s) => set((st) => ({ blueprints: { ...st.blueprints, [key]: s } })),
  dropBlueprint: (key) =>
    set((st) => {
      const next = { ...st.blueprints };
      delete next[key];
      return { blueprints: next };
    }),
  setAdCopy: (s) => set({ adCopy: s }),
}));
