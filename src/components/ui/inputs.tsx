"use client";
import { forwardRef, useId } from "react";
import { cn } from "./cn";
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    variant?: "pill" | "field";
};
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ variant = "pill", className, ...rest }, ref) {
    return (<input ref={ref} className={cn("border border-line text-fg outline-none transition-colors focus:border-accent/60", variant === "pill" ? "rounded-pill bg-fill px-4 py-[10px] text-sm" : "rounded-mini bg-input px-3.5 py-2.5 text-[13px]", className)} {...rest}/>);
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn("min-h-24 rounded-mini border border-line bg-input px-3.5 py-2.5 text-[13px] text-fg outline-none focus:border-accent/60", className)} {...rest}/>;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
    return (<select ref={ref} className={cn("rounded-mini border border-line bg-input px-3 py-2.5 text-[13px] text-fg outline-none focus:border-accent/60", className)} {...rest}>
      {children}
    </select>);
});
interface FieldProps {
    label: React.ReactNode;
    hint?: React.ReactNode;
    error?: string | null;
    children: (id: string) => React.ReactNode;
    className?: string;
    aside?: React.ReactNode;
}
export function Field({ label, hint, error, children, className, aside }: FieldProps) {
    const id = useId();
    return (<div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="label-mono">
          {label}
        </label>
        {aside}
      </div>
      {children(id)}
      {error ? <span className="text-xs text-crit">{error}</span> : hint ? <span className="text-xs text-muted-3">{hint}</span> : null}
    </div>);
}
