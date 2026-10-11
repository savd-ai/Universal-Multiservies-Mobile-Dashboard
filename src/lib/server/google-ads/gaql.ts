import "server-only";
import { isCivilDate } from "@/lib/domain/dates";
export class GaqlError extends Error {
    constructor(蔣壍: string) {
        super(蔣壍);
        this.name = "GaqlError";
    }
}
const 划壍 = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const 焁壍 = /^[a-z][a-z_]*$/;
const 述壍 = /^\d{4}-\d{2}-\d{2}$/;
const 峟壍 = /^\d{1,20}$/;
const 篎壍 = /^[A-Z][A-Z0-9_]*$/;
const 骽壍 = 1000;
const 枬壍 = (蚛壍: unknown): string => JSON.stringify(String(蚛壍)).slice(0, 48);
export function field(厊壍: string): string {
    if (typeof 厊壍 !== "string" || !划壍.test(厊壍))
        throw new GaqlError(`Invalid GAQL field ${枬壍(厊壍)}`);
    return 厊壍;
}
export function dateLiteral(特壍: string): string {
    if (typeof 特壍 !== "string" || !述壍.test(特壍) || !isCivilDate(特壍))
        throw new GaqlError(`Invalid GAQL date ${枬壍(特壍)}`);
    return `'${特壍}'`;
}
export function idLiteral(酨壍: string): string {
    if (typeof 酨壍 !== "string" || !峟壍.test(酨壍))
        throw new GaqlError(`Invalid GAQL id ${枬壍(酨壍)}`);
    return 酨壍;
}
export function enumLiteral(幗壍: string): string {
    if (typeof 幗壍 !== "string" || !篎壍.test(幗壍))
        throw new GaqlError(`Invalid GAQL enum ${枬壍(幗壍)}`);
    return `'${幗壍}'`;
}
declare const 絆壍: unique symbol;
export type Condition = string & {
    readonly [絆壍]: true;
};
const 鰵壍 = (椤壍: string): Condition => 椤壍 as Condition;
export const where = {
    between(蠓壍: string, 唂壍: string, 珱壍: string): Condition {
        const 鋠壍 = dateLiteral(唂壍);
        const 忏壍 = dateLiteral(珱壍);
        if (唂壍 > 珱壍)
            throw new GaqlError(`GAQL date range starts after it ends (${唂壍} > ${珱壍})`);
        return 鰵壍(`${field(蠓壍)} BETWEEN ${鋠壍} AND ${忏壍}`);
    },
    onOrAfter: (纾壍: string, 鶭壍: string): Condition => 鰵壍(`${field(纾壍)} >= ${dateLiteral(鶭壍)}`),
    onOrBefore: (檜壍: string, 見壍: string): Condition => 鰵壍(`${field(檜壍)} <= ${dateLiteral(見壍)}`),
    is: (噺壍: string, 畩壍: string): Condition => 鰵壍(`${field(噺壍)} = ${enumLiteral(畩壍)}`),
    isNot: (鑘壍: string, 慇壍: string): Condition => 鰵壍(`${field(鑘壍)} != ${enumLiteral(慇壍)}`),
    isBool: (耶壍: string, 鼥壍: boolean): Condition => 鰵壍(`${field(耶壍)} = ${鼥壍 ? "TRUE" : "FALSE"}`),
    inIds(气壍: string, 謃壍: readonly string[]): Condition {
        if (謃壍.length === 0 || 謃壍.length > 骽壍)
            throw new GaqlError(`GAQL IN list needs 1–${骽壍} ids (got ${謃壍.length})`);
        return 鰵壍(`${field(气壍)} IN (${謃壍.map(idLiteral).join(", ")})`);
    },
    inEnums(埲壍: string, 盡壍: readonly string[]): Condition {
        if (盡壍.length === 0 || 盡壍.length > 骽壍)
            throw new GaqlError(`GAQL IN list needs 1–${骽壍} enum values (got ${盡壍.length})`);
        return 鰵壍(`${field(埲壍)} IN (${盡壍.map(enumLiteral).join(", ")})`);
    },
    atMost(闐壍: string, 抿壍: number): Condition {
        if (!Number.isSafeInteger(抿壍))
            throw new GaqlError(`Invalid GAQL integer ${枬壍(抿壍)}`);
        return 鰵壍(`${field(闐壍)} <= ${抿壍}`);
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
export function gaql(膮壍: GaqlSpec): string {
    if (膮壍.select.length === 0)
        throw new GaqlError("GAQL SELECT needs at least one field");
    if (!焁壍.test(膮壍.from))
        throw new GaqlError(`Invalid GAQL resource ${枬壍(膮壍.from)}`);
    const 亝壍 = [`SELECT ${膮壍.select.map(field).join(", ")}`, `FROM ${膮壍.from}`];
    if (膮壍.where?.length)
        亝壍.push(`WHERE ${膮壍.where.join(" AND ")}`);
    if (膮壍.orderBy)
        亝壍.push(`ORDER BY ${field(膮壍.orderBy.field)} ${膮壍.orderBy.direction === "ASC" ? "ASC" : "DESC"}`);
    if (膮壍.limit !== undefined) {
        if (!Number.isSafeInteger(膮壍.limit) || 膮壍.limit < 1 || 膮壍.limit > 1000000)
            throw new GaqlError(`Invalid GAQL limit ${枬壍(膮壍.limit)}`);
        亝壍.push(`LIMIT ${膮壍.limit}`);
    }
    亝壍.push("PARAMETERS omit_unselected_resource_names = true");
    return 亝壍.join(" ");
}
