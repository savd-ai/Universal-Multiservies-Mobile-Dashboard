"use client";
import { useMemo } from "react";
import GridLayout, { useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout";
import type { GridItem } from "@/lib/domain/contracts/dashboard";
import { COLS, MARGIN, ROW_H } from "./layout-engine";
export interface RglGridProps {
    layout: readonly GridItem[];
    minSizes: Record<string, {
        w: number;
        h: number;
    } | undefined>;
    onCommit: (layout: GridItem[]) => void;
    renderItem: (item: GridItem) => React.ReactNode;
}
const toGrid = (l: Layout): GridItem[] => l.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
export function RglGrid({ layout, minSizes, onCommit, renderItem }: RglGridProps) {
    const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
    const controlled = useMemo(() => withMins(layout, minSizes), [layout, minSizes]);
    return (<div ref={containerRef} className="min-w-0">
      {mounted ? (<GridLayout width={width} layout={controlled} gridConfig={{ cols: COLS, rowHeight: ROW_H, margin: [MARGIN, MARGIN], containerPadding: [0, 0] }} dragConfig={{ enabled: true, handle: ".rgl-handle", cancel: ".rgl-no-drag", threshold: 3 }} resizeConfig={{ enabled: true, handles: ["se", "e", "s"] }} compactor={verticalCompactor} onDragStop={(l) => onCommit(toGrid(l))} onResizeStop={(l) => onCommit(toGrid(l))}>
          {layout.map((item) => (<div key={item.i} className="flex">
              {renderItem(item)}
            </div>))}
        </GridLayout>) : null}
    </div>);
}
function withMins(layout: readonly GridItem[], mins: RglGridProps["minSizes"]): LayoutItem[] {
    return layout.map((l) => ({ ...l, minW: Math.min(mins[l.i]?.w ?? 1, COLS), minH: mins[l.i]?.h ?? 2 }));
}
