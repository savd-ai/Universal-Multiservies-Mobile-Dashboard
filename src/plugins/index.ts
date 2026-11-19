import "server-only";
import type { PluginRuntime } from "@/lib/server/plugins/define";
import { BUILTIN_ALERT_PLUGINS } from "./builtin/alerts";
import { BUILTIN_DEMO_PLUGINS } from "./builtin/catalog";
import { CUSTOM_CODE_PLUGINS } from "./custom";

// Static plugin list (bundler-safe: no filesystem scanning). Stored no-code REST plugins are added at runtime by
// lib/server/plugins/registry.ts.

export const STATIC_PLUGINS: PluginRuntime[] = [...BUILTIN_DEMO_PLUGINS, ...BUILTIN_ALERT_PLUGINS, ...CUSTOM_CODE_PLUGINS];

export const RESERVED_PLUGIN_IDS = new Set(STATIC_PLUGINS.map((p) => p.manifest.id));
