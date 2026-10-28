"use client";
import { useRef } from "react";
import { cn } from "./cn";
interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    tone?: "default" | "add";
    dot?: string;
    count?: number | string;
}
export function Chip({ active, tone = "default", dot, count, className, children, type: value = "button", ...rest }: ChipProps) {
    return (<button type={value} aria-pressed={tone === "default" ? !!active : undefined} className={cn("inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors", tone === "add" ? "border-teal/30 text-accent hover:border-teal/60" : active ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:border-tone/25 hover:text-fg", className)} {...rest}>
      {dot ? <span className="size-[7px] rounded-full" style={{ background: dot }} aria-hidden/> : null}
      {children}
      {count !== undefined ? <span className="font-mono text-meta text-muted-3">{count}</span> : null}
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
    onChange: (v: T) => void;
    ariaLabel: string;
    variant?: "mono" | "sans";
    fill?: boolean;
    size?: "sm" | "md";
    className?: string;
}
export function Segmented<T extends string | number>({ options, value, onChange, ariaLabel, variant = "mono", fill, size = "sm", className }: SegmentedProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft")
            return;
        e.preventDefault();
        const next = (idx + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
        const opt = options[next];
        if (opt) {
            onChange(opt.value);
            refs.current[next]?.focus();
        }
    };
    return (<div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKey} className={cn("flex flex-wrap gap-0.5 rounded-pill border border-line bg-fill p-[3px] max-sm:rounded-[18px]", fill && "w-full", className)}>
      {options.map((o, i) => {
            const on = o.value === value;
            return (<button key={String(o.value)} ref={(el) => {
                    refs.current[i] = el;
                }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} title={o.title} onClick={() => onChange(o.value)} className={cn("rounded-pill transition-colors", size === "sm" ? "px-3.5 py-1.5" : "px-4 py-[7px]", variant === "mono" ? "font-mono text-meta tracking-[0.08em]" : "text-xs", fill && "flex-1 text-center", on ? "bg-accent text-on-accent" : "text-muted hover:text-fg")}>
            {o.label}
          </button>);
        })}
    </div>);
}
interface SwitchProps {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: React.ReactNode;
    size?: "md" | "sm";
    ariaLabel?: string;
    className?: string;
    disabled?: boolean;
}
export function Switch({ checked, onChange, label, size = "sm", ariaLabel, className, disabled }: SwitchProps) {
    const md = size === "md";
    return (<button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} disabled={disabled} onClick={() => onChange(!checked)} className={cn("inline-flex items-center gap-3 text-left disabled:opacity-50", className)}>
      <span className={cn("relative shrink-0 rounded-pill transition-colors", md ? "h-6 w-11" : "h-[18px] w-[30px]", checked ? "bg-accent" : md ? "bg-[rgba(120,120,128,0.2)]" : "bg-tone/12")}>
        <span className={cn("absolute rounded-pill bg-knob shadow-knob transition-[left] duration-200", md ? "top-[3px] size-[18px]" : "top-[2px] size-[14px]")} style={{ left: checked ? (md ? 23 : 14) : md ? 3 : 2 }}/>
      </span>
      {label ? <span className="text-[13px]">{label}</span> : null}
    </button>);
}
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
    value: number;
    onChange: (v: number) => void;
}
export function Slider({ value, onChange, className, ...rest }: SliderProps) {
    return <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} className={cn("w-full cursor-pointer", className)} {...rest}/>;
}
interface CheckboxProps {
    checked: boolean | "mixed";
    onChange: (v: boolean) => void;
    ariaLabel: string;
    className?: string;
}
export function Checkbox({ checked, onChange, ariaLabel, className }: CheckboxProps) {
    return (<button type="button" role="checkbox" aria-checked={checked === "mixed" ? "mixed" : checked} aria-label={ariaLabel} onClick={(e) => {
            e.stopPropagation();
            onChange(checked !== true);
        }} className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] border text-[10px] leading-none transition-colors", checked ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-transparent text-transparent hover:border-tone/40", className)}>
      {checked === "mixed" ? "–" : "✓"}
    </button>);
}
