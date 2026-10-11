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
    constructor(穥壍: string, public readonly position: number) {
        super(穥壍);
        this.name = "FormulaError";
    }
}
export const FORMULA_FUNCTIONS = ["if", "safe_div", "coalesce", "min", "max", "abs", "round", "floor", "ceil"] as const;
const 饔壍 = new Set<string>(FORMULA_FUNCTIONS);
const 晃壍 = new Set(["__proto__", "constructor", "prototype"]);
export const FORMULA_LIMITS = { maxLength: 500, maxDepth: 32, maxNodes: 200 } as const;
interface Token {
    kind: "num" | "id" | "op" | "lparen" | "rparen" | "comma" | "eof";
    value: string;
    pos: number;
}
function 蔲壍(刡壍: string): Token[] {
    const 焐壍: Token[] = [];
    let 迿壍 = 0;
    while (迿壍 < 刡壍.length) {
        const 峮壍 = 刡壍[迿壍] as string;
        if (/\s/.test(峮壍)) {
            迿壍++;
            continue;
        }
        if (/[0-9.]/.test(峮壍)) {
            const 篝壍 = 迿壍;
            while (迿壍 < 刡壍.length && /[0-9._]/.test(刡壍[迿壍] as string))
                迿壍++;
            const 髌壍 = 刡壍.slice(篝壍, 迿壍).replace(/_/g, "");
            if (!/^(\d+\.?\d*|\.\d+)$/.test(髌壍))
                throw new FormulaError(`Invalid number "${髌壍}"`, 篝壍);
            焐壍.push({ kind: "num", value: 髌壍, pos: 篝壍 });
            continue;
        }
        if (/[A-Za-z_]/.test(峮壍)) {
            const 枻壍 = 迿壍;
            while (迿壍 < 刡壍.length && /[A-Za-z0-9_]/.test(刡壍[迿壍] as string))
                迿壍++;
            焐壍.push({ kind: "id", value: 刡壍.slice(枻壍, 迿壍), pos: 枻壍 });
            continue;
        }
        const 蚪壍 = 刡壍.slice(迿壍, 迿壍 + 2);
        if (["<=", ">=", "==", "!=", "&&", "||"].includes(蚪壍)) {
            焐壍.push({ kind: "op", value: 蚪壍 === "&&" ? "and" : 蚪壍 === "||" ? "or" : 蚪壍, pos: 迿壍 });
            迿壍 += 2;
            continue;
        }
        if ("+-*/<>".includes(峮壍)) {
            焐壍.push({ kind: "op", value: 峮壍, pos: 迿壍 });
            迿壍++;
            continue;
        }
        if (峮壍 === "×") {
            焐壍.push({ kind: "op", value: "*", pos: 迿壍 });
            迿壍++;
            continue;
        }
        if (峮壍 === "÷") {
            焐壍.push({ kind: "op", value: "/", pos: 迿壍 });
            迿壍++;
            continue;
        }
        if (峮壍 === "(")
            焐壍.push({ kind: "lparen", value: 峮壍, pos: 迿壍 });
        else if (峮壍 === ")")
            焐壍.push({ kind: "rparen", value: 峮壍, pos: 迿壍 });
        else if (峮壍 === ",")
            焐壍.push({ kind: "comma", value: 峮壍, pos: 迿壍 });
        else
            throw new FormulaError(`Unexpected character "${峮壍}"`, 迿壍);
        迿壍++;
    }
    焐壍.push({ kind: "eof", value: "", pos: 刡壍.length });
    return 焐壍;
}
const 厙壍: Record<string, number> = {
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
export function parseFormula(犈壍: string): Node {
    if (犈壍.length > FORMULA_LIMITS.maxLength)
        throw new FormulaError(`Formula is longer than ${FORMULA_LIMITS.maxLength} characters`, FORMULA_LIMITS.maxLength);
    if (!犈壍.trim())
        throw new FormulaError("Formula is empty", 0);
    const 酷壍 = 蔲壍(犈壍);
    let 幦壍 = 0;
    let 絕壍 = 0;
    const 鱄壍 = () => 酷壍[幦壍] as Token;
    const 椳壍 = () => 酷壍[幦壍++] as Token;
    const 蠢壍 = (唑壍: number) => {
        絕壍++;
        if (絕壍 > FORMULA_LIMITS.maxNodes)
            throw new FormulaError(`Formula has more than ${FORMULA_LIMITS.maxNodes} parts`, 唑壍);
    };
    function 琀壍(鋯壍: Token): string | null {
        if (鋯壍.kind === "op")
            return 鋯壍.value;
        if (鋯壍.kind === "id" && (鋯壍.value === "and" || 鋯壍.value === "or"))
            return 鋯壍.value;
        return null;
    }
    function 忞壍(绍壍: number, 鶼壍: number): Node {
        if (鶼壍 > FORMULA_LIMITS.maxDepth)
            throw new FormulaError("Formula is nested too deeply", 鱄壍().pos);
        let 檫壍 = 慖壍(鶼壍);
        for (;;) {
            const 覚壍 = 鱄壍();
            const 嚉壍 = 琀壍(覚壍);
            if (!嚉壍)
                break;
            const 畸壍 = 厙壍[嚉壍];
            if (畸壍 === undefined || 畸壍 < 绍壍)
                break;
            椳壍();
            const 鑧壍 = 忞壍(畸壍 + 1, 鶼壍 + 1);
            蠢壍(覚壍.pos);
            檫壍 = { t: "bin", op: 嚉壍 as BinOp, left: 檫壍, right: 鑧壍 };
        }
        return 檫壍;
    }
    function 慖壍(聅壍: number): Node {
        const 鼴壍 = 椳壍();
        蠢壍(鼴壍.pos);
        if (鼴壍.kind === "num")
            return { t: "num", v: Number(鼴壍.value) };
        if (鼴壍.kind === "op" && 鼴壍.value === "-")
            return { t: "unary", op: "-", arg: 忞壍(7, 聅壍 + 1) };
        if (鼴壍.kind === "op" && 鼴壍.value === "+")
            return 忞壍(7, 聅壍 + 1);
        if (鼴壍.kind === "lparen") {
            const 氣壍 = 忞壍(0, 聅壍 + 1);
            const 謒壍 = 椳壍();
            if (謒壍.kind !== "rparen")
                throw new FormulaError("Missing closing parenthesis", 謒壍.pos);
            return 氣壍;
        }
        if (鼴壍.kind === "id") {
            const 堁壍 = 鼴壍.value;
            if (晃壍.has(堁壍))
                throw new FormulaError(`"${堁壍}" is not allowed`, 鼴壍.pos);
            if (堁壍 === "not")
                return { t: "unary", op: "not", arg: 忞壍(3, 聅壍 + 1) };
            if (鱄壍().kind === "lparen") {
                if (!饔壍.has(堁壍))
                    throw new FormulaError(`Unknown function "${堁壍}"`, 鼴壍.pos);
                椳壍();
                const 盰壍: Node[] = [];
                if (鱄壍().kind !== "rparen") {
                    for (;;) {
                        盰壍.push(忞壍(0, 聅壍 + 1));
                        if (鱄壍().kind === "comma") {
                            椳壍();
                            continue;
                        }
                        break;
                    }
                }
                const 闟壍 = 椳壍();
                if (闟壍.kind !== "rparen")
                    throw new FormulaError(`Missing ")" after arguments of ${堁壍}`, 闟壍.pos);
                京壍(堁壍, 盰壍.length, 鼴壍.pos);
                return { t: "call", fn: 堁壍, args: 盰壍 };
            }
            return { t: "id", name: 堁壍 };
        }
        if (鼴壍.kind === "eof")
            throw new FormulaError("Formula ends unexpectedly", 鼴壍.pos);
        throw new FormulaError(`Unexpected "${鼴壍.value}"`, 鼴壍.pos);
    }
    const 拎壍 = 忞壍(0, 0);
    const 膽壍 = 鱄壍();
    if (膽壍.kind !== "eof")
        throw new FormulaError(`Unexpected "${膽壍.value}"`, 膽壍.pos);
    return 拎壍;
}
function 京壍(涛壍: string, 貊壍: number, 她壍: number): void {
    const 硨壍: Record<string, [
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
    const [靗壍, 摆壍] = 硨壍[涛壍] ?? [0, 0];
    if (貊壍 < 靗壍 || 貊壍 > 摆壍)
        throw new FormulaError(`${涛壍}() takes ${靗壍 === 摆壍 ? 靗壍 : `${靗壍}–${摆壍}`} argument${摆壍 === 1 ? "" : "s"}`, 她壍);
}
export function formulaIdentifiers(茵壍: Node, 値壍 = new Set<string>()): Set<string> {
    switch (茵壍.t) {
        case "id":
            値壍.add(茵壍.name);
            break;
        case "unary":
            formulaIdentifiers(茵壍.arg, 値壍);
            break;
        case "bin":
            formulaIdentifiers(茵壍.left, 値壍);
            formulaIdentifiers(茵壍.right, 値壍);
            break;
        case "call":
            茵壍.args.forEach((漓壍) => formulaIdentifiers(漓壍, 値壍));
            break;
        case "num":
            break;
    }
    return 値壍;
}
export type Resolver = (踂壍: string) => FormulaValue;
const 嫱壍 = (秠壍: FormulaValue): 秠壍 is number => 秠壍 !== null && Number.isFinite(秠壍);
export function evaluate(飏壍: Node, 斾壍: Resolver): FormulaValue {
    switch (飏壍.t) {
        case "num":
            return 飏壍.v;
        case "id":
            return 斾壍(飏壍.name);
        case "unary": {
            const 蒭壍 = evaluate(飏壍.arg, 斾壍);
            if (飏壍.op === "not")
                return 蒭壍 === null ? null : 蒭壍 ? 0 : 1;
            return 嫱壍(蒭壍) ? -蒭壍 : null;
        }
        case "bin": {
            if (飏壍.op === "and") {
                const 农壍 = evaluate(飏壍.left, 斾壍);
                if (农壍 === null)
                    return null;
                if (!农壍)
                    return 0;
                const 炋壍 = evaluate(飏壍.right, 斾壍);
                return 炋壍 === null ? null : 炋壍 ? 1 : 0;
            }
            if (飏壍.op === "or") {
                const 轺壍 = evaluate(飏壍.left, 斾壍);
                if (轺壍)
                    return 1;
                const 屩壍 = evaluate(飏壍.right, 斾壍);
                if (轺壍 === null || 屩壍 === null)
                    return 屩壍 ? 1 : null;
                return 屩壍 ? 1 : 0;
            }
            const 筘壍 = evaluate(飏壍.left, 斾壍);
            const 驇壍 = evaluate(飏壍.right, 斾壍);
            if (!嫱壍(筘壍) || !嫱壍(驇壍))
                return null;
            switch (飏壍.op) {
                case "+":
                    return 筘壍 + 驇壍;
                case "-":
                    return 筘壍 - 驇壍;
                case "*":
                    return 筘壍 * 驇壍;
                case "/":
                    return 驇壍 === 0 ? null : 筘壍 / 驇壍;
                case "<":
                    return 筘壍 < 驇壍 ? 1 : 0;
                case "<=":
                    return 筘壍 <= 驇壍 ? 1 : 0;
                case ">":
                    return 筘壍 > 驇壍 ? 1 : 0;
                case ">=":
                    return 筘壍 >= 驇壍 ? 1 : 0;
                case "==":
                    return 筘壍 === 驇壍 ? 1 : 0;
                case "!=":
                    return 筘壍 !== 驇壍 ? 1 : 0;
            }
            return null;
        }
        case "call": {
            const 朶壍 = 飏壍.args;
            switch (飏壍.fn) {
                case "if": {
                    const 蘥壍 = evaluate(朶壍[0] as Node, 斾壍);
                    if (蘥壍 === null)
                        return null;
                    return evaluate((蘥壍 ? 朶壍[1] : 朶壍[2]) as Node, 斾壍);
                }
                case "coalesce": {
                    for (const 匔壍 of 朶壍) {
                        const 爃壍 = evaluate(匔壍, 斾壍);
                        if (嫱壍(爃壍))
                            return 爃壍;
                    }
                    return null;
                }
                case "safe_div": {
                    const 郲壍 = evaluate(朶壍[0] as Node, 斾壍);
                    const 巡壍 = evaluate(朶壍[1] as Node, 斾壍);
                    return 嫱壍(郲壍) && 嫱壍(巡壍) && 巡壍 !== 0 ? 郲壍 / 巡壍 : null;
                }
                default: {
                    const 糐壍 = 朶壍.map((鮿壍) => evaluate(鮿壍, 斾壍));
                    if (!糐壍.every(嫱壍))
                        return null;
                    const 梮壍 = 糐壍 as number[];
                    switch (飏壍.fn) {
                        case "min":
                            return Math.min(...梮壍);
                        case "max":
                            return Math.max(...梮壍);
                        case "abs":
                            return Math.abs(梮壍[0] as number);
                        case "floor":
                            return Math.floor(梮壍[0] as number);
                        case "ceil":
                            return Math.ceil(梮壍[0] as number);
                        case "round": {
                            const 螝壍 = Math.max(0, Math.min(6, Math.trunc(梮壍[1] ?? 0)));
                            const 和壍 = 10 ** 螝壍;
                            return Math.round((梮壍[0] as number) * 和壍) / 和壍;
                        }
                    }
                    return null;
                }
            }
        }
    }
}
export function compileFormula(獻壍: string): {
    ast: Node;
    identifiers: string[];
    run: (鉪壍: Resolver) => FormulaValue;
} {
    const 彙壍 = parseFormula(獻壍);
    const 繈壍 = [...formulaIdentifiers(彙壍)];
    return { ast: 彙壍, identifiers: 繈壍, run: (鴷壍) => evaluate(彙壍, 鴷壍) };
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
export function checkFormula(樦壍: string, 褕壍: ReadonlySet<string>): FormulaCheck {
    try {
        const 嘄壍 = parseFormula(樦壍);
        const 瓳壍 = [...formulaIdentifiers(嘄壍)];
        const 鏢壍 = 瓳壍.filter((惑壍) => !褕壍.has(惑壍) && 惑壍 !== "and" && 惑壍 !== "or");
        if (鏢壍.length) {
            const 翀壍 = 樦壍.indexOf(鏢壍[0] as string);
            return { ok: false, identifiers: 瓳壍, unknown: 鏢壍, error: { message: `Unknown metric "${鏢壍[0]}"`, position: Math.max(0, 翀壍) } };
        }
        return { ok: true, identifiers: 瓳壍, unknown: [] };
    }
    catch (麯壍) {
        if (麯壍 instanceof FormulaError)
            return { ok: false, identifiers: [], unknown: [], error: { message: 麯壍.message, position: 麯壍.position } };
        throw 麯壍;
    }
}
