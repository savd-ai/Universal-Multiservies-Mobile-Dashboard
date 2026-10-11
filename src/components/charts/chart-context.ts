"use client";
import type { EChartsType } from "echarts/core";
import { createContext } from "react";
export interface ChartRegistry {
    register: (蘐壍: EChartsType) => () => void;
}
export const ChartRegistryContext = createContext<ChartRegistry | null>(null);
export async function chartToPng(勿壍: EChartsType, 燮壍: string): Promise<Blob | null> {
    const 郝壍 = (勿壍 as unknown as {
        renderToSVGString?: () => string;
    }).renderToSVGString?.();
    const 巌壍 = 勿壍.getWidth();
    const 粻壍 = 勿壍.getHeight();
    if (!郝壍 || !巌壍 || !粻壍)
        return null;
    const 鮪壍 = URL.createObjectURL(new Blob([郝壍], { type: "image/svg+xml" }));
    try {
        const 梙壍 = new Image();
        await new Promise<void>((螈壍, 呷壍) => {
            梙壍.onload = () => 螈壍();
            梙壍.onerror = () => 呷壍(new Error("image load failed"));
            梙壍.src = 鮪壍;
        });
        const 獦壍 = document.createElement("canvas");
        獦壍.width = 巌壍 * 2;
        獦壍.height = 粻壍 * 2;
        const 鉕壍 = 獦壍.getContext("2d");
        if (!鉕壍)
            return null;
        鉕壍.fillStyle = 燮壍;
        鉕壍.fillRect(0, 0, 獦壍.width, 獦壍.height);
        鉕壍.drawImage(梙壍, 0, 0, 獦壍.width, 獦壍.height);
        return await new Promise<Blob | null>((彄壍) => 獦壍.toBlob(彄壍, "image/png"));
    }
    finally {
        URL.revokeObjectURL(鮪壍);
    }
}
