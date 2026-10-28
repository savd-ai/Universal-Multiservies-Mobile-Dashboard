import { cn } from "./cn";
const SEPARATOR = /[\s_\-|/·—–.:,]/;
export function splitTail(text: string, max = 18): [
    string,
    string
] {
    if (text.length <= 12)
        return [text, ""];
    let at = -1;
    for (let i = text.length - 1; i > 0; i--) {
        const len = text.length - i;
        if (len > max)
            break;
        if (len >= 4 && SEPARATOR.test(text.charAt(i)))
            at = i;
    }
    return at > 0 ? [text.slice(0, at), text.slice(at)] : [text, ""];
}
export function middleEllipsis(text: string, maxChars: number): string {
    if (text.length <= maxChars)
        return text;
    const [, tail] = splitTail(text, Math.max(6, Math.floor(maxChars * 0.6)));
    const keep = tail || text.slice(-Math.floor(maxChars / 2));
    return `${text.slice(0, Math.max(1, maxChars - keep.length - 1))}…${keep}`;
}
export function MiddleTruncate({ text, className }: {
    text: string;
    className?: string;
}) {
    const [head, tail] = splitTail(text);
    if (!tail) {
        return (<span className={cn("block min-w-0 truncate", className)} title={text}>
        {text}
      </span>);
    }
    return (<span className={cn("flex min-w-0", className)} title={text}>
      <span className="min-w-[2.5ch] overflow-hidden text-ellipsis whitespace-pre">{head}</span>
      <span className="min-w-0 shrink-[0.001] overflow-hidden text-ellipsis whitespace-pre">{tail}</span>
    </span>);
}
