#!/usr/bin/env node
// Prints a new APP_ENCRYPTION_KEY (32 random bytes, base64url). Put it in .env to let the dashboard store secrets
// entered in the UI (alert webhook URLs, custom-plugin API keys) encrypted with AES-256-GCM. Losing or changing
// the key makes previously stored secrets unreadable — re-enter them.
import { randomBytes } from "node:crypto";

console.log(`APP_ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`);
