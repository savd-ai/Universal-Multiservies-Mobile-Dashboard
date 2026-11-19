import "server-only";
import type { PluginRuntime } from "@/lib/server/plugins/define";

// Code plugins. Scaffold a new one with `npm run plugin:new -- <id> --category ad_platform`; the script creates
// src/plugins/custom/<id>/index.ts and appends it to this list. Keep this file's import/export shape — the
// scaffold edits it.
// plugin-imports:start
// plugin-imports:end

export const CUSTOM_CODE_PLUGINS: PluginRuntime[] = [
  // plugin-list:start
  // plugin-list:end
];
