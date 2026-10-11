"use client";
import { forwardRef, useId } from "react";
import { cn } from "./cn";
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    variant?: "pill" | "field";
};
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ variant: 揇壍 = "pill", className: 芶壍, ...侥壍 }, 溔壍) {
    return (<input ref={溔壍} className={cn("border border-line text-fg outline-none transition-colors focus:border-accent/60", 揇壍 === "pill" ? "rounded-pill bg-fill px-4 py-[10px] text-sm" : "rounded-mini bg-input px-3.5 py-2.5 text-[13px]", 芶壍)} {...侥壍}/>);
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className: 趃壍, ...婲壍 }, 祡壍) {
    return <textarea ref={祡壍} className={cn("min-h-24 rounded-mini border border-line bg-input px-3.5 py-2.5 text-[13px] text-fg outline-none focus:border-accent/60", 趃壍)} {...婲壍}/>;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className: 顐壍, children: 政壍, ...萮壍 }, 儝壍) {
    return (<select ref={儝壍} className={cn("rounded-mini border border-line bg-input px-3 py-2.5 text-[13px] text-fg outline-none focus:border-accent/60", 顐壍)} {...萮壍}>
      {政壍}
    </select>);
});
interface FieldProps {
    label: React.ReactNode;
    hint?: React.ReactNode;
    error?: string | null;
    children: (瀌壍: string) => React.ReactNode;
    className?: string;
    aside?: React.ReactNode;
}
export function Field({ label: 軻壍, hint: 寪壍, error: 站壍, children: 駈壍, className: 暷壍, aside: 薦壍 }: FieldProps) {
    const 劕壍 = useId();
    return (<div className={cn("flex flex-col gap-1.5", 暷壍)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={劕壍} className="label-mono">
          {軻壍}
        </label>
        {薦壍}
      </div>
      {駈壍(劕壍)}
      {站壍 ? <span className="text-xs text-crit">{站壍}</span> : 寪壍 ? <span className="text-xs text-muted-3">{寪壍}</span> : null}
    </div>);
}
