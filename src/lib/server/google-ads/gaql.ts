import "server-only";
import { isCivilDate } from "@/lib/domain/dates";
export class GaqlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GaqlError";
    }
}
const FIELD_RE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const RESOURCE_RE = /^[a-z][a-z_]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^\d{1,20}$/;
const ENUM_RE = /^[A-Z][A-Z0-9_]*$/;
const MAX_IN_VALUES = 1000;
const preview = (value: unknown): string => JSON.stringify(String(value)).slice(0, 48);
export function field(name: string): string {
    if (typeof name !== "string" || !FIELD_RE.test(name))
        throw new GaqlError(`Invalid GAQL field ${preview(name)}`);
    return name;
}
export function dateLiteral(value: string): string {
    if (typeof value !== "string" || !DATE_RE.test(value) || !isCivilDate(value))
        throw new GaqlError(`Invalid GAQL date ${preview(value)}`);
    return `'${value}'`;
}
export function idLiteral(value: string): string {
    if (typeof value !== "string" || !ID_RE.test(value))
        throw new GaqlError(`Invalid GAQL id ${preview(value)}`);
    return value;
}
export function enumLiteral(value: string): string {
    if (typeof value !== "string" || !ENUM_RE.test(value))
        throw new GaqlError(`Invalid GAQL enum ${preview(value)}`);
    return `'${value}'`;
}
declare const conditionBrand: unique symbol;
export type Condition = string & {
    readonly [conditionBrand]: true;
};
const condition = (sql: string): Condition => sql as Condition;
export const where = {
    between(name: string, start: string, end: string): Condition {
        const s = dateLiteral(start);
        const e = dateLiteral(end);
        if (start > end)
            throw new GaqlError(`GAQL date range starts after it ends (${start} > ${end})`);
        return condition(`${field(name)} BETWEEN ${s} AND ${e}`);
    },
    onOrAfter: (name: string, date: string): Condition => condition(`${field(name)} >= ${dateLiteral(date)}`),
    onOrBefore: (name: string, date: string): Condition => condition(`${field(name)} <= ${dateLiteral(date)}`),
    is: (name: string, value: string): Condition => condition(`${field(name)} = ${enumLiteral(value)}`),
    isNot: (name: string, value: string): Condition => condition(`${field(name)} != ${enumLiteral(value)}`),
    isBool: (name: string, value: boolean): Condition => condition(`${field(name)} = ${value ? "TRUE" : "FALSE"}`),
    inIds(name: string, ids: readonly string[]): Condition {
        if (ids.length === 0 || ids.length > MAX_IN_VALUES)
            throw new GaqlError(`GAQL IN list needs 1–${MAX_IN_VALUES} ids (got ${ids.length})`);
        return condition(`${field(name)} IN (${ids.map(idLiteral).join(", ")})`);
    },
    inEnums(name: string, values: readonly string[]): Condition {
        if (values.length === 0 || values.length > MAX_IN_VALUES)
            throw new GaqlError(`GAQL IN list needs 1–${MAX_IN_VALUES} enum values (got ${values.length})`);
        return condition(`${field(name)} IN (${values.map(enumLiteral).join(", ")})`);
    },
    atMost(name: string, value: number): Condition {
        if (!Number.isSafeInteger(value))
            throw new GaqlError(`Invalid GAQL integer ${preview(value)}`);
        return condition(`${field(name)} <= ${value}`);
    },
};
export interface GaqlSpec {
    select: readonly string[];
    from: string;
    where?: readonly Condition[];
    orderBy?: {
        field: string;
        direction: "ASC" | "DESC";
    };
    limit?: number;
}
export function gaql(spec: GaqlSpec): string {
    if (spec.select.length === 0)
        throw new GaqlError("GAQL SELECT needs at least one field");
    if (!RESOURCE_RE.test(spec.from))
        throw new GaqlError(`Invalid GAQL resource ${preview(spec.from)}`);
    const parts = [`SELECT ${spec.select.map(field).join(", ")}`, `FROM ${spec.from}`];
    if (spec.where?.length)
        parts.push(`WHERE ${spec.where.join(" AND ")}`);
    if (spec.orderBy)
        parts.push(`ORDER BY ${field(spec.orderBy.field)} ${spec.orderBy.direction === "ASC" ? "ASC" : "DESC"}`);
    if (spec.limit !== undefined) {
        if (!Number.isSafeInteger(spec.limit) || spec.limit < 1 || spec.limit > 1000000)
            throw new GaqlError(`Invalid GAQL limit ${preview(spec.limit)}`);
        parts.push(`LIMIT ${spec.limit}`);
    }
    parts.push("PARAMETERS omit_unselected_resource_names = true");
    return parts.join(" ");
}
