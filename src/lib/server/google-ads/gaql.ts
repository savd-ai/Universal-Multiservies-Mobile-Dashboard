import "server-only";
import { isCivilDate } from "@/lib/domain/dates";

// GAQL builder. Only validated literals ever reach a query string: civil dates, numeric ids, enum constants and
// integers. User-entered text filters (campaign names, search terms…) are applied by the query engine after the
// rows are fetched — they are never pushed into GAQL.

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
const MAX_IN_VALUES = 1_000;

const preview = (value: unknown): string => JSON.stringify(String(value)).slice(0, 48);

export function field(name: string): string {
  if (typeof name !== "string" || !FIELD_RE.test(name)) throw new GaqlError(`Invalid GAQL field ${preview(name)}`);
  return name;
}

export function dateLiteral(value: string): string {
  if (typeof value !== "string" || !DATE_RE.test(value) || !isCivilDate(value)) throw new GaqlError(`Invalid GAQL date ${preview(value)}`);
  return `'${value}'`;
}

export function idLiteral(value: string): string {
  if (typeof value !== "string" || !ID_RE.test(value)) throw new GaqlError(`Invalid GAQL id ${preview(value)}`);
  return value;
}

export function enumLiteral(value: string): string {
  if (typeof value !== "string" || !ENUM_RE.test(value)) throw new GaqlError(`Invalid GAQL enum ${preview(value)}`);
  return `'${value}'`;
}

declare const conditionBrand: unique symbol;
/** A WHERE condition assembled only from validated parts (build it with `where.*`). */
export type Condition = string & { readonly [conditionBrand]: true };

const condition = (sql: string): Condition => sql as Condition;

export const where = {
  between(name: string, start: string, end: string): Condition {
    const s = dateLiteral(start);
    const e = dateLiteral(end);
    if (start > end) throw new GaqlError(`GAQL date range starts after it ends (${start} > ${end})`);
    return condition(`${field(name)} BETWEEN ${s} AND ${e}`);
  },
  onOrAfter: (name: string, date: string): Condition => condition(`${field(name)} >= ${dateLiteral(date)}`),
  onOrBefore: (name: string, date: string): Condition => condition(`${field(name)} <= ${dateLiteral(date)}`),
  is: (name: string, value: string): Condition => condition(`${field(name)} = ${enumLiteral(value)}`),
  isNot: (name: string, value: string): Condition => condition(`${field(name)} != ${enumLiteral(value)}`),
  isBool: (name: string, value: boolean): Condition => condition(`${field(name)} = ${value ? "TRUE" : "FALSE"}`),
  inIds(name: string, ids: readonly string[]): Condition {
    if (ids.length === 0 || ids.length > MAX_IN_VALUES) throw new GaqlError(`GAQL IN list needs 1–${MAX_IN_VALUES} ids (got ${ids.length})`);
    return condition(`${field(name)} IN (${ids.map(idLiteral).join(", ")})`);
  },
  inEnums(name: string, values: readonly string[]): Condition {
    if (values.length === 0 || values.length > MAX_IN_VALUES) throw new GaqlError(`GAQL IN list needs 1–${MAX_IN_VALUES} enum values (got ${values.length})`);
    return condition(`${field(name)} IN (${values.map(enumLiteral).join(", ")})`);
  },
  atMost(name: string, value: number): Condition {
    if (!Number.isSafeInteger(value)) throw new GaqlError(`Invalid GAQL integer ${preview(value)}`);
    return condition(`${field(name)} <= ${value}`);
  },
};

export interface GaqlSpec {
  select: readonly string[];
  from: string;
  where?: readonly Condition[];
  orderBy?: { field: string; direction: "ASC" | "DESC" };
  limit?: number;
}

export function gaql(spec: GaqlSpec): string {
  if (spec.select.length === 0) throw new GaqlError("GAQL SELECT needs at least one field");
  if (!RESOURCE_RE.test(spec.from)) throw new GaqlError(`Invalid GAQL resource ${preview(spec.from)}`);
  const parts = [`SELECT ${spec.select.map(field).join(", ")}`, `FROM ${spec.from}`];
  if (spec.where?.length) parts.push(`WHERE ${spec.where.join(" AND ")}`);
  if (spec.orderBy) parts.push(`ORDER BY ${field(spec.orderBy.field)} ${spec.orderBy.direction === "ASC" ? "ASC" : "DESC"}`);
  if (spec.limit !== undefined) {
    if (!Number.isSafeInteger(spec.limit) || spec.limit < 1 || spec.limit > 1_000_000) throw new GaqlError(`Invalid GAQL limit ${preview(spec.limit)}`);
    parts.push(`LIMIT ${spec.limit}`);
  }
  // Rows only carry the fields we asked for (smaller payloads); resource names are selected explicitly when needed.
  parts.push("PARAMETERS omit_unselected_resource_names = true");
  return parts.join(" ");
}
