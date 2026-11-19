"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ChannelsSummary, CustomPluginRecord, ManifestValidationResult, PluginDetail, PluginPreviewResult, PluginSecretsInput, PluginView } from "@/lib/domain/contracts/plugins";
import type { DateRange } from "@/lib/domain/dates";
import { request, saveBlob } from "./client";
import { qk, useAccountId } from "./hooks";

// Plugins page + Channels page data: the gallery, connect / disconnect / test / sync, no-code REST plugins
// (validate, preview, save, import / export) and the cross-channel ledger. The gallery key ["plugins"] is the one
// usePlugins() uses too, so every consumer refreshes together. Bodyless writes send `{}` (JSON content type).

export interface PluginList {
  plugins: PluginView[];
  /** APP_ENCRYPTION_KEY is set: secrets can be saved from the UI */
  encryption: boolean;
}

export interface PluginTestResult {
  ok: boolean;
  message: string;
  testedAt: string;
  details?: Record<string, unknown>;
}

export interface PluginSyncResult {
  ok: boolean;
  lastSyncAt: string;
  rows: number | null;
  message: string;
}

export interface CustomSaveResult {
  plugin: CustomPluginRecord;
  warnings: string[];
  created: boolean;
  view: PluginView;
}

export interface ManifestBody {
  manifest: unknown;
  secrets?: PluginSecretsInput;
}

const enc = encodeURIComponent;

/** Everything a plugin change can move: gallery, status counts, channel ledger / blended queries, alert channels. */
function invalidatePluginData(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["plugins"] });
  void qc.invalidateQueries({ queryKey: qk.status() });
  void qc.invalidateQueries({ queryKey: ["acct"] });
  void qc.invalidateQueries({ queryKey: ["alerts"] });
  void qc.invalidateQueries({ queryKey: ["audit"] });
}

export function usePluginList() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: ({ signal }) => request<PluginList>("/api/plugins", { signal }),
    staleTime: 60_000,
  });
}

export function usePluginDetail(id: string | null) {
  return useQuery({
    queryKey: ["plugins", "detail", id ?? ""],
    queryFn: ({ signal }) => request<PluginDetail>(`/api/plugins/${enc(id ?? "")}`, { signal }),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCustomPluginRecord(id: string | null) {
  return useQuery({
    queryKey: ["plugins", "custom", id ?? ""],
    queryFn: ({ signal }) => request<CustomPluginRecord>(`/api/plugins/custom/${enc(id ?? "")}`, { signal }),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useConnectPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) => request<{ plugin: PluginView; channel: unknown }>(`/api/plugins/${enc(id)}/connect`, { body: { values } }),
    onSuccess: () => invalidatePluginData(qc),
  });
}

export function useDisconnectPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ plugin: PluginView }>(`/api/plugins/${enc(id)}/disconnect`, { body: {} }),
    onSuccess: () => invalidatePluginData(qc),
  });
}

export function useTestPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<PluginTestResult>(`/api/plugins/${enc(id)}/test`, { body: {} }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["plugins"] }),
  });
}

export function useSyncPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<PluginSyncResult>(`/api/plugins/${enc(id)}/sync`, { body: {} }),
    onSettled: () => invalidatePluginData(qc),
  });
}

// ── No-code REST plugins ──────────────────────────────────────────────────────────────────────────────

export function useValidateManifest() {
  return useMutation({ mutationFn: (body: ManifestBody) => request<ManifestValidationResult>("/api/plugins/custom/validate", { body }) });
}

export function usePreviewManifest() {
  return useMutation({ mutationFn: (body: ManifestBody) => request<PluginPreviewResult>("/api/plugins/custom/preview", { body }) });
}

/** Create (no id) or replace (PUT, optimistic `version`) a custom plugin. Creating also connects it. */
export function useSaveCustomPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, ...body }: ManifestBody & { id?: string | null; version?: number }) =>
      id ? request<CustomSaveResult>(`/api/plugins/custom/${enc(id)}`, { method: "PUT", body: { ...body, version } }) : request<CustomSaveResult>("/api/plugins/custom", { body }),
    onSuccess: () => invalidatePluginData(qc),
  });
}

export function useImportCustomPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManifestBody & { replace?: boolean }) => request<CustomSaveResult>("/api/plugins/custom/import", { body }),
    onSuccess: () => invalidatePluginData(qc),
  });
}

export function useDeleteCustomPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: true }>(`/api/plugins/custom/${enc(id)}`, { method: "DELETE" }),
    onSuccess: () => invalidatePluginData(qc),
  });
}

/** Download the portable manifest file (the server never includes credentials). */
export async function exportCustomPlugin(id: string): Promise<void> {
  const file = await request<unknown>(`/api/plugins/custom/${enc(id)}/export`);
  saveBlob(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }), `${id}.plugin.json`);
}

// ── Channels ──────────────────────────────────────────────────────────────────────────────────────────

/** Cross-channel ledger for a resolved date range (the top bar's range). */
export function useChannels(range: DateRange | null) {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "channels", range?.start ?? "", range?.end ?? ""],
    queryFn: ({ signal }) => request<ChannelsSummary>("/api/channels", { query: { from: range?.start, to: range?.end }, signal }),
    enabled: !!acct && !!range,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
