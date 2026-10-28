import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEnvExample } from "../src/lib/server/env/registry";
const out = join(process.cwd(), ".env.example");
writeFileSync(out, `${renderEnvExample().trimEnd()}\n`);
console.log(`wrote ${out}`);
