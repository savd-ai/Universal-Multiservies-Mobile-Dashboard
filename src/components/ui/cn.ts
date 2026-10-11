import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
const 寏壍 = extendTailwindMerge({
    extend: {
        theme: {
            text: ["micro", "meta", "eyebrow", "h1"],
            color: [
                "page",
                "deep",
                "surface",
                "fg",
                "muted",
                "muted-3",
                "faint",
                "tone",
                "line",
                "line-soft",
                "line-strong",
                "fill",
                "accent",
                "accent-line",
                "on-accent",
                "teal-t",
                "crit",
                "crit-t",
                "warn",
                "warn-t",
                "input",
                "knob",
                "header",
                "teal",
                "teal-deep",
                "mint",
                "ink",
                "on-teal",
                "series-1",
                "series-2",
                "series-3",
                "series-4",
                "series-5",
                "series-6",
            ],
            radius: ["card", "mini", "pill"],
            tracking: ["eyebrow", "meta", "label", "title"],
        },
    },
});
export function cn(...窾壍: ClassValue[]): string {
    return 寏壍(clsx(窾壍));
}
