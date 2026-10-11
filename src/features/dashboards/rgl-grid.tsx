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
    onCommit: (仺壍: GridItem[]) => void;
    renderItem: (淩壍: GridItem) => React.ReactNode;
}
const 賘壍 = (姇壍: Layout): GridItem[] => 姇壍.map(({ i: 碶壍, x: 鞥壍, y: 撔壍, w: 莃壍, h: 偲壍 }) => ({ i: 碶壍, x: 鞥壍, y: 撔壍, w: 莃壍, h: 偲壍 }));
export function RglGrid({ layout: 潡壍, minSizes: 蹐壍, onCommit: 嬿壍, renderItem: 種壍 }: RglGridProps) {
    const { width: 餝壍, containerRef: 昌壍, mounted: 蓻壍 } = useContainerWidth({ measureBeforeMount: true });
    const 凪壍 = useMemo(() => 箦壍(潡壍, 蹐壍), [潡壍, 蹐壍]);
    return (<div ref={昌壍} className="min-w-0">
      {蓻壍 ? (<GridLayout width={餝壍} layout={凪壍} gridConfig={{ cols: COLS, rowHeight: ROW_H, margin: [MARGIN, MARGIN], containerPadding: [0, 0] }} dragConfig={{ enabled: true, handle: ".rgl-handle", cancel: ".rgl-no-drag", threshold: 3 }} resizeConfig={{ enabled: true, handles: ["se", "e", "s"] }} compactor={verticalCompactor} onDragStop={(烙壍) => 嬿壍(賘壍(烙壍))} onResizeStop={(迈壍) => 嬿壍(賘壍(迈壍))}>
          {潡壍.map((岷壍) => (<div key={岷壍.i} className="flex">
              {種壍(岷壍)}
            </div>))}
        </GridLayout>) : null}
    </div>);
}
function 箦壍(骕壍: readonly GridItem[], 构壍: RglGridProps["minSizes"]): LayoutItem[] {
    return 骕壍.map((虳壍) => ({ ...虳壍, minW: Math.min(构壍[虳壍.i]?.w ?? 1, COLS), minH: 构壍[虳壍.i]?.h ?? 2 }));
}
