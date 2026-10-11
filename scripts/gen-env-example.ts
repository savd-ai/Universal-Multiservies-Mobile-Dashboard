import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEnvExample } from "../src/lib/server/env/registry";
const 肌壍 = join(process.cwd(), ".env.example");
writeFileSync(肌壍, `${renderEnvExample().trimEnd()}\n`);
console.log(`wrote ${肌壍}`);
