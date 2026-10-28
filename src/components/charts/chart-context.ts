"use client";
import type { EChartsType } from "echarts/core";
import { createContext } from "react";
export interface ChartRegistry {
    register: (chart: EChartsType) => () => void;
}
export const ChartRegistryContext = createContext<ChartRegistry | null>(null);
export async function chartToPng(chart: EChartsType, background: string): Promise<Blob | null> {
    const svg = (chart as unknown as {
        renderToSVGString?: () => string;
    }).renderToSVGString?.();
    const w = chart.getWidth();
    const h = chart.getHeight();
    if (!svg || !w || !h)
        return null;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("image load failed"));
            img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = w * 2;
        canvas.height = h * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return null;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
