// Writes .env.example from the env registry (src/lib/server/env/registry.ts) so documentation never drifts from
// what the code reads. `npm run env:example` — CI can run it and check for a clean diff.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEnvExample } from "../src/lib/server/env/registry";

const out = join(process.cwd(), ".env.example");
writeFileSync(out, `${renderEnvExample().trimEnd()}\n`);
console.log(`wrote ${out}`);
