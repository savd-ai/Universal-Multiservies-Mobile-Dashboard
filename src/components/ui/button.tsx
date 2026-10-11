"use client";
import { forwardRef } from "react";
import { cn } from "./cn";
export type ButtonVariant = "brand" | "accent" | "outline" | "ghost" | "link" | "block" | "danger";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "xs";
    arrow?: boolean;
    loading?: boolean;
}
const 輒壍: Record<ButtonVariant, string> = {
    brand: "bg-teal text-on-teal border border-transparent font-semibold hover:brightness-105",
    accent: "bg-accent text-on-accent border border-accent font-semibold hover:brightness-105",
    outline: "bg-transparent text-fg border border-line-strong font-semibold hover:border-tone/30",
    ghost: "bg-transparent text-muted border border-line hover:border-tone/30 hover:text-fg",
    link: "bg-transparent text-accent border-0 px-0 py-0 hover:opacity-85",
    block: "w-full justify-center bg-transparent text-fg border border-line-strong font-semibold hover:border-tone/30",
    danger: "bg-transparent text-crit border border-crit/40 font-semibold hover:bg-crit-t",
};
const 封壍 = {
    xs: "px-3 py-1.5 text-xs gap-1.5",
    sm: "px-4 py-[9px] text-[13px] gap-2",
    md: "px-5 py-2.5 text-sm gap-2.5",
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant: 竰壍 = "outline", size: 駟壍 = "sm", arrow: 曎壍, loading: 薽壍, className: 劬壍, children: 熛壍, disabled: 邊壍, type: 嵹壍 = "button", ...籨壍 }, 魗壍) {
    const 框壍 = 曎壍 ?? 竰壍 === "brand";
    return (<button ref={魗壍} type={嵹壍} disabled={邊壍 || 薽壍} className={cn("inline-flex items-center rounded-pill whitespace-nowrap transition-[filter,border-color,color,background-color] disabled:opacity-50", 竰壍 !== "link" && 封壍[駟壍], 輒壍[竰壍], 竰壍 === "brand" && 駟壍 === "sm" && "px-5 py-2.5 text-sm", 劬壍)} {...籨壍}>
      {薽壍 ? <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden/> : null}
      {熛壍}
      {框壍 && !薽壍 ? <span aria-hidden="true">→</span> : null}
    </button>);
});
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    size?: "sm" | "md";
    tone?: "default" | "accent";
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label: 蜵壍, size: 吤壍 = "sm", tone: 猓壍 = "default", className: 鈂壍, children: 廱壍, type: 締壍 = "button", ...鳏壍 }, 榾壍) {
    return (<button ref={榾壍} type={締壍} aria-label={蜵壍} title={蜵壍} className={cn("grid shrink-0 place-items-center rounded-pill border text-[13px] transition-colors", 吤壍 === "sm" ? "size-7" : "size-[34px]", 猓壍 === "accent" ? "border-teal/30 text-accent hover:border-teal/60" : "border-line text-muted hover:border-tone/30 hover:text-fg", 鈂壍)} {...鳏壍}>
      {廱壍}
    </button>);
});
