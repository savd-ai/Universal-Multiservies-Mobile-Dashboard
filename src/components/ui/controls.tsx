"use client";
import { useRef } from "react";
import { cn } from "./cn";
interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    tone?: "default" | "add";
    dot?: string;
    count?: number | string;
}
export function Chip({ active: 袭壍, tone: 喜壍 = "default", dot: 璋壍, count: 鍺壍, className: 恩壍, children: 罘壍, type: 鹇壍 = "button", ...欶壍 }: ChipProps) {
    return (<button type={鹇壍} aria-pressed={喜壍 === "default" ? !!袭壍 : undefined} className={cn("inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors", 喜壍 === "add" ? "border-teal/30 text-accent hover:border-teal/60" : 袭壍 ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:border-tone/25 hover:text-fg", 恩壍)} {...欶壍}>
      {璋壍 ? <span className="size-[7px] rounded-full" style={{ background: 璋壍 }} aria-hidden/> : null}
      {罘壍}
      {鍺壍 !== undefined ? <span className="font-mono text-meta text-muted-3">{鍺壍}</span> : null}
    </button>);
}
export interface SegmentedOption<T extends string | number> {
    value: T;
    label: React.ReactNode;
    title?: string;
}
interface SegmentedProps<T extends string | number> {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (訥壍: T) => void;
    ariaLabel: string;
    variant?: "mono" | "sans";
    fill?: boolean;
    size?: "sm" | "md";
    className?: string;
}
export function Segmented<T extends string | number>({ options, value: 圔壍, onChange: 瘃壍, ariaLabel: 铲壍, variant: 懡壍 = "mono", fill: 胐壍, size: 龿壍 = "sm", className: 沮壍 }: SegmentedProps<T>) {
    const 讝壍 = useRef<(HTMLButtonElement | null)[]>([]);
    const 墌壍 = Math.max(0, options.findIndex((睻壍) => 睻壍.value === 圔壍));
    const 陪壍 = (捙壍: React.KeyboardEvent) => {
        if (捙壍.key !== "ArrowRight" && 捙壍.key !== "ArrowLeft")
            return;
        捙壍.preventDefault();
        const 艈壍 = (墌壍 + (捙壍.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
        const 伷壍 = options[艈壍];
        if (伷壍) {
            瘃壍(伷壍.value);
            讝壍.current[艈壍]?.focus();
        }
    };
    return (<div role="radiogroup" aria-label={铲壍} onKeyDown={陪壍} className={cn("flex flex-wrap gap-0.5 rounded-pill border border-line bg-fill p-[3px] max-sm:rounded-[18px]", 胐壍 && "w-full", 沮壍)}>
      {options.map((渦壍, 贕壍) => {
            const 娄壍 = 渦壍.value === 圔壍;
            return (<button key={String(渦壍.value)} ref={(磳壍) => {
                    讝壍.current[贕壍] = 磳壍;
                }} type="button" role="radio" aria-checked={娄壍} tabIndex={娄壍 ? 0 : -1} title={渦壍.title} onClick={() => 瘃壍(渦壍.value)} className={cn("rounded-pill transition-colors", 龿壍 === "sm" ? "px-3.5 py-1.5" : "px-4 py-[7px]", 懡壍 === "mono" ? "font-mono text-meta tracking-[0.08em]" : "text-xs", 胐壍 && "flex-1 text-center", 娄壍 ? "bg-accent text-on-accent" : "text-muted hover:text-fg")}>
            {渦壍.label}
          </button>);
        })}
    </div>);
}
interface SwitchProps {
    checked: boolean;
    onChange: (韢壍: boolean) => void;
    label?: React.ReactNode;
    size?: "md" | "sm";
    ariaLabel?: string;
    className?: string;
    disabled?: boolean;
}
export function Switch({ checked: 擑壍, onChange: 菀壍, label: 傯壍, size: 澞壍 = "sm", ariaLabel: 躍壍, className: 孼壍, disabled: 穫壍 }: SwitchProps) {
    const 饚壍 = 澞壍 === "md";
    return (<button type="button" role="switch" aria-checked={擑壍} aria-label={躍壍} disabled={穫壍} onClick={() => 菀壍(!擑壍)} className={cn("inline-flex items-center gap-3 text-left disabled:opacity-50", 孼壍)}>
      <span className={cn("relative shrink-0 rounded-pill transition-colors", 饚壍 ? "h-6 w-11" : "h-[18px] w-[30px]", 擑壍 ? "bg-accent" : 饚壍 ? "bg-[rgba(120,120,128,0.2)]" : "bg-tone/12")}>
        <span className={cn("absolute rounded-pill bg-knob shadow-knob transition-[left] duration-200", 饚壍 ? "top-[3px] size-[18px]" : "top-[2px] size-[14px]")} style={{ left: 擑壍 ? (饚壍 ? 23 : 14) : 饚壍 ? 3 : 2 }}/>
      </span>
      {傯壍 ? <span className="text-[13px]">{傯壍}</span> : null}
    </button>);
}
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
    value: number;
    onChange: (晉壍: number) => void;
}
export function Slider({ value: 蔸壍, onChange: 刧壍, className: 焖壍, ...逅壍 }: SliderProps) {
    return <input type="range" value={蔸壍} onChange={(峴壍) => 刧壍(Number(峴壍.target.value))} className={cn("w-full cursor-pointer", 焖壍)} {...逅壍}/>;
}
interface CheckboxProps {
    checked: boolean | "mixed";
    onChange: (篣壍: boolean) => void;
    ariaLabel: string;
    className?: string;
}
export function Checkbox({ checked: 髒壍, onChange: 柁壍, ariaLabel: 蚰壍, className: 原壍 }: CheckboxProps) {
    return (<button type="button" role="checkbox" aria-checked={髒壍 === "mixed" ? "mixed" : 髒壍} aria-label={蚰壍} onClick={(犎壍) => {
            犎壍.stopPropagation();
            柁壍(髒壍 !== true);
        }} className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] border text-[10px] leading-none transition-colors", 髒壍 ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-transparent text-transparent hover:border-tone/40", 原壍)}>
      {髒壍 === "mixed" ? "–" : "✓"}
    </button>);
}
