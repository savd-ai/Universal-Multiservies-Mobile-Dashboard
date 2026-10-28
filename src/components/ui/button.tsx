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
const VARIANTS: Record<ButtonVariant, string> = {
    brand: "bg-teal text-on-teal border border-transparent font-semibold hover:brightness-105",
    accent: "bg-accent text-on-accent border border-accent font-semibold hover:brightness-105",
    outline: "bg-transparent text-fg border border-line-strong font-semibold hover:border-tone/30",
    ghost: "bg-transparent text-muted border border-line hover:border-tone/30 hover:text-fg",
    link: "bg-transparent text-accent border-0 px-0 py-0 hover:opacity-85",
    block: "w-full justify-center bg-transparent text-fg border border-line-strong font-semibold hover:border-tone/30",
    danger: "bg-transparent text-crit border border-crit/40 font-semibold hover:bg-crit-t",
};
const SIZES = {
    xs: "px-3 py-1.5 text-xs gap-1.5",
    sm: "px-4 py-[9px] text-[13px] gap-2",
    md: "px-5 py-2.5 text-sm gap-2.5",
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "outline", size = "sm", arrow, loading, className, children, disabled, type: value = "button", ...rest }, ref) {
    const showArrow = arrow ?? variant === "brand";
    return (<button ref={ref} type={value} disabled={disabled || loading} className={cn("inline-flex items-center rounded-pill whitespace-nowrap transition-[filter,border-color,color,background-color] disabled:opacity-50", variant !== "link" && SIZES[size], VARIANTS[variant], variant === "brand" && size === "sm" && "px-5 py-2.5 text-sm", className)} {...rest}>
      {loading ? <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden/> : null}
      {children}
      {showArrow && !loading ? <span aria-hidden="true">→</span> : null}
    </button>);
});
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    size?: "sm" | "md";
    tone?: "default" | "accent";
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, size = "sm", tone = "default", className, children, type: value = "button", ...rest }, ref) {
    return (<button ref={ref} type={value} aria-label={label} title={label} className={cn("grid shrink-0 place-items-center rounded-pill border text-[13px] transition-colors", size === "sm" ? "size-7" : "size-[34px]", tone === "accent" ? "border-teal/30 text-accent hover:border-teal/60" : "border-line text-muted hover:border-tone/30 hover:text-fg", className)} {...rest}>
      {children}
    </button>);
});
