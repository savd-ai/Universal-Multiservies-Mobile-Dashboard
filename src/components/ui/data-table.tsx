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
    sortValue?: (row: T) => number | string | null | undefined;
    cell: (row: T, index: number) => React.ReactNode;
    total?: React.ReactNode;
    hidden?: boolean;
    className?: string;
}
export interface DataTableProps<T> {
    rows: readonly T[];
    columns: Column<T>[];
    rowKey: (row: T) => string;
    onRowClick?: (row: T) => void;
    selectable?: boolean;
    selected?: ReadonlySet<string>;
    onSelectedChange?: (next: Set<string>) => void;
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
    rowClassName?: (row: T) => string | undefined;
    className?: string;
}
export function DataTable<T>(props: DataTableProps<T>) {
    const { rows, columns, rowKey, onRowClick, selectable, selected, onSelectedChange, initialSort, density = "comfortable", minWidth = 620, maxHeight, virtualizeAfter = 200, empty, ariaLabel, rowClassName, className } = props;
    const [sort, setSort] = useState<{
        key: string;
        dir: "asc" | "desc";
    } | null>(initialSort ?? null);
    const visible = columns.filter((c) => !c.hidden);
    const template = [selectable ? "28px" : null, ...visible.map((c) => c.width ?? "minmax(80px,1fr)")].filter(Boolean).join(" ");
    const sorted = useMemo(() => {
        const col = sort ? columns.find((c) => c.key === sort.key) : null;
        if (!col?.sortValue)
            return rows;
        const dir = sort?.dir === "asc" ? 1 : -1;
        const sortValue = col.sortValue;
        return [...rows].sort((a, b) => {
            const x = sortValue(a);
            const y = sortValue(b);
            if (x === y)
                return 0;
            if (x === null || x === undefined)
                return 1;
            if (y === null || y === undefined)
                return -1;
            return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
        });
    }, [rows, columns, sort]);
    const allKeys = useMemo(() => sorted.map(rowKey), [sorted, rowKey]);
    const allSelected = !!selected && allKeys.length > 0 && allKeys.every((k) => selected.has(k));
    const toggleAll = () => onSelectedChange?.(allSelected ? new Set() : new Set(allKeys));
    const toggle = (k: string) => {
        if (!selected || !onSelectedChange)
            return;
        const next = new Set(selected);
        if (next.has(k))
            next.delete(k);
        else
            next.add(k);
        onSelectedChange(next);
    };
    const scrollRef = useRef<HTMLDivElement>(null);
    const virtual = sorted.length > virtualizeAfter;
    const rowH = density === "compact" ? 40 : 54;
    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({ count: virtual ? sorted.length : 0, getScrollElement: () => scrollRef.current, estimateSize: () => rowH, overscan: 12 });
    const header = (<div role="row" className="sticky top-0 z-[1] grid items-end gap-3 border-b border-line bg-surface px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: template }}>
      {selectable ? (<span role="columnheader" className="flex items-center">
          <Checkbox checked={allSelected} onChange={toggleAll} ariaLabel="Select all rows"/>
        </span>) : null}
      {visible.map((c) => {
            const active = sort?.key === c.key;
            const align = c.align === "right" ? "justify-end text-right" : c.align === "center" ? "justify-center" : "";
            if (!c.sortValue)
                return (<span key={c.key} role="columnheader" className={cn("flex truncate", align)}>
              {c.header}
            </span>);
            return (<button key={c.key} type="button" role="columnheader" aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : "none"} onClick={() => setSort(active ? { key: c.key, dir: sort?.dir === "desc" ? "asc" : "desc" } : { key: c.key, dir: "desc" })} className={cn("flex truncate uppercase transition-colors hover:text-fg", align, active && "text-fg")}>
            {c.header}
            {active ? (sort?.dir === "desc" ? " ↓" : " ↑") : ""}
          </button>);
        })}
    </div>);
    const renderRow = (row: T, i: number, style?: React.CSSProperties) => {
        const k = rowKey(row);
        const isSel = !!selected?.has(k);
        return (<div key={k} role="row" aria-selected={selectable ? isSel : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("grid items-center gap-3 border-b border-line-soft px-1 text-[13px] tabular", density === "compact" ? "py-2" : "py-3", onRowClick && "cursor-pointer hover:bg-fill", isSel && "bg-teal-t/60", rowClassName?.(row))} style={{ gridTemplateColumns: template, ...style }}>
        {selectable ? (<span role="cell" className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSel} onChange={() => toggle(k)} ariaLabel="Select row"/>
          </span>) : null}
        {visible.map((c) => (<span key={c.key} role="cell" className={cn("min-w-0", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
            {c.cell(row, i)}
          </span>))}
      </div>);
    };
    const hasTotals = visible.some((c) => c.total !== undefined);
    return (<div ref={scrollRef} className={cn("relative -mx-1 overflow-auto px-1", className)} style={{ maxHeight }} role="region" aria-label={ariaLabel} tabIndex={0}>
      <div role="table" aria-label={ariaLabel} aria-rowcount={sorted.length} className="flex flex-col" style={{ minWidth }}>
        {header}
        {sorted.length === 0 ? (<div role="row">
            <div role="cell" className="p-6 text-center text-[13px] text-muted-3">
              {empty ?? "No rows."}
            </div>
          </div>) : null}
        {virtual ? (<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((v) => {
                const row = sorted[v.index];
                return row === undefined ? null : renderRow(row, v.index, { position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` });
            })}
          </div>) : (sorted.map((r, i) => renderRow(r, i)))}
        {hasTotals && sorted.length > 0 ? (<div role="row" className="grid items-center gap-3 px-1 pt-3 text-[13px] font-semibold tabular" style={{ gridTemplateColumns: template }}>
            {selectable ? <span /> : null}
            {visible.map((c) => (<span key={c.key} role="cell" className={cn("min-w-0", c.align === "right" && "text-right")}>
                {c.total ?? null}
              </span>))}
          </div>) : null}
      </div>
    </div>);
}
