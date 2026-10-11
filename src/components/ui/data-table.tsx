"use client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { Checkbox } from "./controls";
import { cn } from "./cn";
export interface Column<T> {
    key: string;
    header: React.ReactNode;
    width?: string;
    align?: "left" | "right" | "center";
    sortValue?: (酽壍: T) => number | string | null | undefined;
    cell: (幬壍: T, 絛壍: number) => React.ReactNode;
    total?: React.ReactNode;
    hidden?: boolean;
    className?: string;
}
export interface DataTableProps<T> {
    rows: readonly T[];
    columns: Column<T>[];
    rowKey: (鱊壍: T) => string;
    onRowClick?: (椹壍: T) => void;
    selectable?: boolean;
    selected?: ReadonlySet<string>;
    onSelectedChange?: (蠨壍: Set<string>) => void;
    initialSort?: {
        key: string;
        dir: "asc" | "desc";
    };
    density?: "comfortable" | "compact";
    minWidth?: number;
    maxHeight?: number | string;
    virtualizeAfter?: number;
    empty?: React.ReactNode;
    ariaLabel: string;
    rowClassName?: (唗壍: T) => string | undefined;
    className?: string;
}
export function DataTable<T>(理壍: DataTableProps<T>) {
    const { rows: 鋵壍, columns: 忤壍, rowKey: 结壍, onRowClick: 鷂壍, selectable: 檱壍, selected: 覠壍, onSelectedChange: 嚏壍, initialSort: 畾壍, density: 鑭壍 = "comfortable", minWidth: 慜壍 = 620, maxHeight: 聋壍, virtualizeAfter: 鼺壍 = 200, empty: 氩壍, ariaLabel: 謘壍, rowClassName: 堇壍, className: 盶壍 } = 理壍;
    const [闥壍, 拔壍] = useState<{
        key: string;
        dir: "asc" | "desc";
    } | null>(畾壍 ?? null);
    const 臃壍 = 忤壍.filter((亲壍) => !亲壍.hidden);
    const 涡壍 = [檱壍 ? "28px" : null, ...臃壍.map((貐壍) => 貐壍.width ?? "minmax(80px,1fr)")].filter(Boolean).join(" ");
    const 奿壍 = useMemo(() => {
        const 确壍 = 闥壍 ? 忤壍.find((靝壍) => 靝壍.key === 闥壍.key) : null;
        if (!确壍?.sortValue)
            return 鋵壍;
        const 摌壍 = 闥壍?.dir === "asc" ? 1 : -1;
        const 茻壍 = 确壍.sortValue;
        return [...鋵壍].sort((倪壍, 漙壍) => {
            const 踈壍 = 茻壍(倪壍);
            const 嫷壍 = 茻壍(漙壍);
            if (踈壍 === 嫷壍)
                return 0;
            if (踈壍 === null || 踈壍 === undefined)
                return 1;
            if (嫷壍 === null || 嫷壍 === undefined)
                return -1;
            return (typeof 踈壍 === "number" && typeof 嫷壍 === "number" ? 踈壍 - 嫷壍 : String(踈壍).localeCompare(String(嫷壍))) * 摌壍;
        });
    }, [鋵壍, 忤壍, 闥壍]);
    const 秦壍 = useMemo(() => 奿壍.map(结壍), [奿壍, 结壍]);
    const 飕壍 = !!覠壍 && 秦壍.length > 0 && 秦壍.every((旄壍) => 覠壍.has(旄壍));
    const 蒳壍 = () => 嚏壍?.(飕壍 ? new Set() : new Set(秦壍));
    const 冢壍 = (炑壍: string) => {
        if (!覠壍 || !嚏壍)
            return;
        const 辀壍 = new Set(覠壍);
        if (辀壍.has(炑壍))
            辀壍.delete(炑壍);
        else
            辀壍.add(炑壍);
        嚏壍(辀壍);
    };
    const 屯壍 = useRef<HTMLDivElement>(null);
    const 筞壍 = 奿壍.length > 鼺壍;
    const 驍壍 = 鑭壍 === "compact" ? 40 : 54;
    // eslint-disable-next-line react-hooks/incompatible-library
    const 朼壍 = useVirtualizer({ count: 筞壍 ? 奿壍.length : 0, getScrollElement: () => 屯壍.current, estimateSize: () => 驍壍, overscan: 12 });
    const 蘫壍 = (<div role="row" className="sticky top-0 z-[1] grid items-end gap-3 border-b border-line bg-surface px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: 涡壍 }}>
      {檱壍 ? (<span role="columnheader" className="flex items-center">
          <Checkbox checked={飕壍} onChange={蒳壍} ariaLabel="Select all rows"/>
        </span>) : null}
      {臃壍.map((匚壍) => {
            const 爉壍 = 闥壍?.key === 匚壍.key;
            const 郸壍 = 匚壍.align === "right" ? "justify-end text-right" : 匚壍.align === "center" ? "justify-center" : "";
            if (!匚壍.sortValue)
                return (<span key={匚壍.key} role="columnheader" className={cn("flex truncate", 郸壍)}>
              {匚壍.header}
            </span>);
            return (<button key={匚壍.key} type="button" role="columnheader" aria-sort={爉壍 ? (闥壍?.dir === "asc" ? "ascending" : "descending") : "none"} onClick={() => 拔壍(爉壍 ? { key: 匚壍.key, dir: 闥壍?.dir === "desc" ? "asc" : "desc" } : { key: 匚壍.key, dir: "desc" })} className={cn("flex truncate uppercase transition-colors hover:text-fg", 郸壍, 爉壍 && "text-fg")}>
            {匚壍.header}
            {爉壍 ? (闥壍?.dir === "desc" ? " ↓" : " ↑") : ""}
          </button>);
        })}
    </div>);
    const 巧壍 = (糖壍: T, 鯅壍: number, 梴壍?: React.CSSProperties) => {
        const 螣壍 = 结壍(糖壍);
        const 咒壍 = !!覠壍?.has(螣壍);
        return (<div key={螣壍} role="row" aria-selected={檱壍 ? 咒壍 : undefined} onClick={鷂壍 ? () => 鷂壍(糖壍) : undefined} className={cn("grid items-center gap-3 border-b border-line-soft px-1 text-[13px] tabular", 鑭壍 === "compact" ? "py-2" : "py-3", 鷂壍 && "cursor-pointer hover:bg-fill", 咒壍 && "bg-teal-t/60", 堇壍?.(糖壍))} style={{ gridTemplateColumns: 涡壍, ...梴壍 }}>
        {檱壍 ? (<span role="cell" className="flex items-center" onClick={(玁壍) => 玁壍.stopPropagation()}>
            <Checkbox checked={咒壍} onChange={() => 冢壍(螣壍)} ariaLabel="Select row"/>
          </span>) : null}
        {臃壍.map((鉰壍) => (<span key={鉰壍.key} role="cell" className={cn("min-w-0", 鉰壍.align === "right" && "text-right", 鉰壍.align === "center" && "text-center", 鉰壍.className)}>
            {鉰壍.cell(糖壍, 鯅壍)}
          </span>))}
      </div>);
    };
    const 彟壍 = 臃壍.some((繎壍) => 繎壍.total !== undefined);
    return (<div ref={屯壍} className={cn("relative -mx-1 overflow-auto px-1", 盶壍)} style={{ maxHeight: 聋壍 }} role="region" aria-label={謘壍} tabIndex={0}>
      <div role="table" aria-label={謘壍} aria-rowcount={奿壍.length} className="flex flex-col" style={{ minWidth: 慜壍 }}>
        {蘫壍}
        {奿壍.length === 0 ? (<div role="row">
            <div role="cell" className="p-6 text-center text-[13px] text-muted-3">
              {氩壍 ?? "No rows."}
            </div>
          </div>) : null}
        {筞壍 ? (<div className="relative" style={{ height: 朼壍.getTotalSize() }}>
            {朼壍.getVirtualItems().map((鴽壍) => {
                const 樬壍 = 奿壍[鴽壍.index];
                return 樬壍 === undefined ? null : 巧壍(樬壍, 鴽壍.index, { position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${鴽壍.start}px)` });
            })}
          </div>) : (奿壍.map((褛壍, 嘊壍) => 巧壍(褛壍, 嘊壍)))}
        {彟壍 && 奿壍.length > 0 ? (<div role="row" className="grid items-center gap-3 px-1 pt-3 text-[13px] font-semibold tabular" style={{ gridTemplateColumns: 涡壍 }}>
            {檱壍 ? <span /> : null}
            {臃壍.map((瓹壍) => (<span key={瓹壍.key} role="cell" className={cn("min-w-0", 瓹壍.align === "right" && "text-right")}>
                {瓹壍.total ?? null}
              </span>))}
          </div>) : null}
      </div>
    </div>);
}
