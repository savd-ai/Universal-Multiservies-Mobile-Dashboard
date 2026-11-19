// Dot-path lookup for mapping JSON API responses to metrics.
//   path := seg ('.' seg)*        seg := ident | ["quoted key"]  followed by zero or more [ … ] selectors
//   selectors: [0] index · [*] every element · [key=value] first match (all matches with transform "sum") · [key!=value]
// Examples: data.rows · metrics.spend · actions[action_type=purchase].value · results[*].cost · "" or "$" = root
// Only own properties are read; __proto__ / constructor / prototype are rejected.

type Selector = { t: "key"; key: string } | { t: "index"; i: number } | { t: "all" } | { t: "filter"; key: string; op: "=" | "!="; value: string };

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export class PathError extends Error {}

export function parsePath(path: string): Selector[] {
  const out: Selector[] = [];
  // JSONPath habit: "$", "$.data.rows" and "$[0]" start at the root
  let i = path.startsWith("$") && (path.length === 1 || path[1] === "." || path[1] === "[") ? 1 : 0;
  const n = path.length;
  const readIdent = () => {
    const start = i;
    while (i < n && /[A-Za-z0-9_$\-]/.test(path[i] as string)) i++;
    return path.slice(start, i);
  };
  while (i < n) {
    const ch = path[i];
    if (ch === ".") {
      i++;
      continue;
    }
    if (ch === "[") {
      const close = path.indexOf("]", i);
      if (close < 0) throw new PathError(`Unclosed [ in "${path}"`);
      const inner = path.slice(i + 1, close).trim();
      i = close + 1;
      if (inner === "*") out.push({ t: "all" });
      else if (/^\d+$/.test(inner)) out.push({ t: "index", i: Number(inner) });
      else if (/^["'].*["']$/.test(inner)) out.push({ t: "key", key: inner.slice(1, -1) });
      else {
        const m = /^([A-Za-z0-9_$\-]+)\s*(!=|=)\s*["']?(.*?)["']?$/.exec(inner);
        if (!m) throw new PathError(`Bad selector [${inner}]`);
        out.push({ t: "filter", key: m[1] as string, op: m[2] as "=" | "!=", value: m[3] as string });
      }
      continue;
    }
    const ident = readIdent();
    if (!ident) throw new PathError(`Unexpected "${ch}" in "${path}"`);
    out.push({ t: "key", key: ident });
  }
  for (const s of out) if ((s.t === "key" || s.t === "filter") && FORBIDDEN.has(s.key)) throw new PathError(`"${s.key}" is not allowed in paths`);
  return out;
}

function own(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  if (FORBIDDEN.has(key)) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
}

/** Resolve a path. Returns an array when the path fans out ([*] or a filter with `all`). */
export function getPath(root: unknown, path: string, opts: { all?: boolean } = {}): unknown {
  const sels = parsePath(path);
  let current: unknown[] = [root];
  let fanned = false;
  for (const s of sels) {
    const next: unknown[] = [];
    for (const v of current) {
      if (s.t === "key") next.push(own(v, s.key));
      else if (s.t === "index") next.push(Array.isArray(v) ? v[s.i] : undefined);
      else if (s.t === "all") {
        if (Array.isArray(v)) {
          next.push(...v);
          fanned = true;
        }
      } else if (Array.isArray(v)) {
        const matches = v.filter((el) => {
          const x = own(el, s.key);
          const eq = x !== undefined && String(x) === s.value;
          return s.op === "=" ? eq : !eq;
        });
        if (opts.all) {
          next.push(...matches);
          fanned = true;
        } else next.push(matches[0]);
      }
    }
    current = next;
  }
  if (fanned) return current.filter((x) => x !== undefined);
  return current[0];
}

/** Coerce API values to numbers: "1,234.50", "12%", "$9.99", numbers, booleans. */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/[,\s$€£¥₫]/g, "");
  if (!s) return null;
  const pct = s.endsWith("%");
  const n = Number(pct ? s.slice(0, -1) : s);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}
