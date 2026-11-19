import { secretsEnabled } from "@/lib/server/crypto/secrets";
import { route } from "@/lib/server/http/api";
import { pluginViews } from "@/lib/server/plugins/registry";

export const runtime = "nodejs";

// Plugin gallery: every built-in, code and custom REST plugin with its connection state. `encryption` tells the
// UI whether secrets can be saved here (APP_ENCRYPTION_KEY) or must go in .env.
export const GET = route({}, async () => ({ plugins: await pluginViews(), encryption: secretsEnabled() }));
