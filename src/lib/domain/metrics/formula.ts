export type FormulaValue = number | null;
export type Node = {
    t: "num";
    v: number;
} | {
    t: "id";
    name: string;
} | {
    t: "unary";
    op: "-" | "not";
    arg: Node;
} | {
    t: "bin";
    op: BinOp;
    left: Node;
    right: Node;
} | {
    t: "call";
    fn: string;
    args: Node[];
};
type BinOp = "+" | "-" | "*" | "/" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "and" | "or";
export class FormulaError extends Error {
    constructor(message: string, public readonly position: number) {
        super(message);
        this.name = "FormulaError";
    }
}
export const FORMULA_FUNCTIONS = ["if", "safe_div", "coalesce", "min", "max", "abs", "round", "floor", "ceil"] as const;
const FUNCTION_SET = new Set<string>(FORMULA_FUNCTIONS);
const FORBIDDEN_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);
export const FORMULA_LIMITS = { maxLength: 500, maxDepth: 32, maxNodes: 200 } as const;
interface Token {
    kind: "num" | "id" | "op" | "lparen" | "rparen" | "comma" | "eof";
    value: string;
    pos: number;
}
function tokenize(src: string): Token[] {
    const out: Token[] = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i] as string;
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (/[0-9.]/.test(ch)) {
            const start = i;
            while (i < src.length && /[0-9._]/.test(src[i] as string))
                i++;
            const raw = src.slice(start, i).replace(/_/g, "");
            if (!/^(\d+\.?\d*|\.\d+)$/.test(raw))
                throw new FormulaError(`Invalid number "${raw}"`, start);
            out.push({ kind: "num", value: raw, pos: start });
            continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            const start = i;
            while (i < src.length && /[A-Za-z0-9_]/.test(src[i] as string))
                i++;
            out.push({ kind: "id", value: src.slice(start, i), pos: start });
            continue;
        }
        const two = src.slice(i, i + 2);
        if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) {
            out.push({ kind: "op", value: two === "&&" ? "and" : two === "||" ? "or" : two, pos: i });
            i += 2;
            continue;
        }
        if ("+-*/<>".includes(ch)) {
            out.push({ kind: "op", value: ch, pos: i });
            i++;
            continue;
        }
        if (ch === "×") {
            out.push({ kind: "op", value: "*", pos: i });
            i++;
            continue;
        }
        if (ch === "÷") {
            out.push({ kind: "op", value: "/", pos: i });
            i++;
            continue;
        }
        if (ch === "(")
            out.push({ kind: "lparen", value: ch, pos: i });
        else if (ch === ")")
            out.push({ kind: "rparen", value: ch, pos: i });
        else if (ch === ",")
            out.push({ kind: "comma", value: ch, pos: i });
        else
            throw new FormulaError(`Unexpected character "${ch}"`, i);
        i++;
    }
    out.push({ kind: "eof", value: "", pos: src.length });
    return out;
}
const BINDING: Record<string, number> = {
    or: 1,
    and: 2,
    "==": 3,
    "!=": 3,
    "<": 4,
    "<=": 4,
    ">": 4,
    ">=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
};
export function parseFormula(src: string): Node {
    if (src.length > FORMULA_LIMITS.maxLength)
        throw new FormulaError(`Formula is longer than ${FORMULA_LIMITS.maxLength} characters`, FORMULA_LIMITS.maxLength);
    if (!src.trim())
        throw new FormulaError("Formula is empty", 0);
    const tokens = tokenize(src);
    let p = 0;
    let nodes = 0;
    const peek = () => tokens[p] as Token;
    const next = () => tokens[p++] as Token;
    const count = (pos: number) => {
        nodes++;
        if (nodes > FORMULA_LIMITS.maxNodes)
            throw new FormulaError(`Formula has more than ${FORMULA_LIMITS.maxNodes} parts`, pos);
    };
    function binOpOf(tok: Token): string | null {
        if (tok.kind === "op")
            return tok.value;
        if (tok.kind === "id" && (tok.value === "and" || tok.value === "or"))
            return tok.value;
        return null;
    }
    function parseExpr(minBp: number, depth: number): Node {
        if (depth > FORMULA_LIMITS.maxDepth)
            throw new FormulaError("Formula is nested too deeply", peek().pos);
        let left = parsePrefix(depth);
        for (;;) {
            const tok = peek();
            const op = binOpOf(tok);
            if (!op)
                break;
            const bp = BINDING[op];
            if (bp === undefined || bp < minBp)
                break;
            next();
            const right = parseExpr(bp + 1, depth + 1);
            count(tok.pos);
            left = { t: "bin", op: op as BinOp, left, right };
        }
        return left;
    }
    function parsePrefix(depth: number): Node {
        const tok = next();
        count(tok.pos);
        if (tok.kind === "num")
            return { t: "num", v: Number(tok.value) };
        if (tok.kind === "op" && tok.value === "-")
            return { t: "unary", op: "-", arg: parseExpr(7, depth + 1) };
        if (tok.kind === "op" && tok.value === "+")
            return parseExpr(7, depth + 1);
        if (tok.kind === "lparen") {
            const inner = parseExpr(0, depth + 1);
            const close = next();
            if (close.kind !== "rparen")
                throw new FormulaError("Missing closing parenthesis", close.pos);
            return inner;
        }
        if (tok.kind === "id") {
            const name = tok.value;
            if (FORBIDDEN_IDENTIFIERS.has(name))
                throw new FormulaError(`"${name}" is not allowed`, tok.pos);
            if (name === "not")
                return { t: "unary", op: "not", arg: parseExpr(3, depth + 1) };
            if (peek().kind === "lparen") {
                if (!FUNCTION_SET.has(name))
                    throw new FormulaError(`Unknown function "${name}"`, tok.pos);
                next();
                const args: Node[] = [];
                if (peek().kind !== "rparen") {
                    for (;;) {
                        args.push(parseExpr(0, depth + 1));
                        if (peek().kind === "comma") {
                            next();
                            continue;
                        }
                        break;
                    }
                }
                const close = next();
                if (close.kind !== "rparen")
                    throw new FormulaError(`Missing ")" after arguments of ${name}`, close.pos);
                checkArity(name, args.length, tok.pos);
                return { t: "call", fn: name, args };
            }
            return { t: "id", name };
        }
        if (tok.kind === "eof")
            throw new FormulaError("Formula ends unexpectedly", tok.pos);
        throw new FormulaError(`Unexpected "${tok.value}"`, tok.pos);
    }
    const ast = parseExpr(0, 0);
    const tail = peek();
    if (tail.kind !== "eof")
        throw new FormulaError(`Unexpected "${tail.value}"`, tail.pos);
    return ast;
}
function checkArity(fn: string, n: number, pos: number): void {
    const ranges: Record<string, [
        number,
        number
    ]> = {
        if: [3, 3],
        safe_div: [2, 2],
        coalesce: [1, 8],
        min: [1, 8],
        max: [1, 8],
        abs: [1, 1],
        round: [1, 2],
        floor: [1, 1],
        ceil: [1, 1],
    };
    const [lo, hi] = ranges[fn] ?? [0, 0];
    if (n < lo || n > hi)
        throw new FormulaError(`${fn}() takes ${lo === hi ? lo : `${lo}–${hi}`} argument${hi === 1 ? "" : "s"}`, pos);
}
export function formulaIdentifiers(ast: Node, out = new Set<string>()): Set<string> {
    switch (ast.t) {
        case "id":
            out.add(ast.name);
            break;
        case "unary":
            formulaIdentifiers(ast.arg, out);
            break;
        case "bin":
            formulaIdentifiers(ast.left, out);
            formulaIdentifiers(ast.right, out);
            break;
        case "call":
            ast.args.forEach((a) => formulaIdentifiers(a, out));
            break;
        case "num":
            break;
    }
    return out;
}
export type Resolver = (name: string) => FormulaValue;
const isNum = (v: FormulaValue): v is number => v !== null && Number.isFinite(v);
export function evaluate(ast: Node, resolve: Resolver): FormulaValue {
    switch (ast.t) {
        case "num":
            return ast.v;
        case "id":
            return resolve(ast.name);
        case "unary": {
            const v = evaluate(ast.arg, resolve);
            if (ast.op === "not")
                return v === null ? null : v ? 0 : 1;
            return isNum(v) ? -v : null;
        }
        case "bin": {
            if (ast.op === "and") {
                const l2 = evaluate(ast.left, resolve);
                if (l2 === null)
                    return null;
                if (!l2)
                    return 0;
                const r2 = evaluate(ast.right, resolve);
                return r2 === null ? null : r2 ? 1 : 0;
            }
            if (ast.op === "or") {
                const l2 = evaluate(ast.left, resolve);
                if (l2)
                    return 1;
                const r2 = evaluate(ast.right, resolve);
                if (l2 === null || r2 === null)
                    return r2 ? 1 : null;
                return r2 ? 1 : 0;
            }
            const l = evaluate(ast.left, resolve);
            const r = evaluate(ast.right, resolve);
            if (!isNum(l) || !isNum(r))
                return null;
            switch (ast.op) {
                case "+":
                    return l + r;
                case "-":
                    return l - r;
                case "*":
                    return l * r;
                case "/":
                    return r === 0 ? null : l / r;
                case "<":
                    return l < r ? 1 : 0;
                case "<=":
                    return l <= r ? 1 : 0;
                case ">":
                    return l > r ? 1 : 0;
                case ">=":
                    return l >= r ? 1 : 0;
                case "==":
                    return l === r ? 1 : 0;
                case "!=":
                    return l !== r ? 1 : 0;
            }
            return null;
        }
        case "call": {
            const args = ast.args;
            switch (ast.fn) {
                case "if": {
                    const c = evaluate(args[0] as Node, resolve);
                    if (c === null)
                        return null;
                    return evaluate((c ? args[1] : args[2]) as Node, resolve);
                }
                case "coalesce": {
                    for (const a of args) {
                        const v = evaluate(a, resolve);
                        if (isNum(v))
                            return v;
                    }
                    return null;
                }
                case "safe_div": {
                    const a = evaluate(args[0] as Node, resolve);
                    const b = evaluate(args[1] as Node, resolve);
                    return isNum(a) && isNum(b) && b !== 0 ? a / b : null;
                }
                default: {
                    const vals = args.map((a) => evaluate(a, resolve));
                    if (!vals.every(isNum))
                        return null;
                    const nums = vals as number[];
                    switch (ast.fn) {
                        case "min":
                            return Math.min(...nums);
                        case "max":
                            return Math.max(...nums);
                        case "abs":
                            return Math.abs(nums[0] as number);
                        case "floor":
                            return Math.floor(nums[0] as number);
                        case "ceil":
                            return Math.ceil(nums[0] as number);
                        case "round": {
                            const d = Math.max(0, Math.min(6, Math.trunc(nums[1] ?? 0)));
                            const f = 10 ** d;
                            return Math.round((nums[0] as number) * f) / f;
                        }
                    }
                    return null;
                }
            }
        }
    }
}
export function compileFormula(src: string): {
    ast: Node;
    identifiers: string[];
    run: (resolve: Resolver) => FormulaValue;
} {
    const ast = parseFormula(src);
    const identifiers = [...formulaIdentifiers(ast)];
    return { ast, identifiers, run: (resolve) => evaluate(ast, resolve) };
}
export interface FormulaCheck {
    ok: boolean;
    error?: {
        message: string;
        position: number;
    };
    identifiers: string[];
    unknown: string[];
}
export function checkFormula(src: string, known: ReadonlySet<string>): FormulaCheck {
    try {
        const ast = parseFormula(src);
        const identifiers = [...formulaIdentifiers(ast)];
        const unknown = identifiers.filter((id) => !known.has(id) && id !== "and" && id !== "or");
        if (unknown.length) {
            const pos = src.indexOf(unknown[0] as string);
            return { ok: false, identifiers, unknown, error: { message: `Unknown metric "${unknown[0]}"`, position: Math.max(0, pos) } };
        }
        return { ok: true, identifiers, unknown: [] };
    }
    catch (e) {
        if (e instanceof FormulaError)
            return { ok: false, identifiers: [], unknown: [], error: { message: e.message, position: e.position } };
        throw e;
    }
}
