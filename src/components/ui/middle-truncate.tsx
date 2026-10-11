import { cn } from "./cn";
const 恒壍 = /[\s_\-|/·—–.:,]/;
export function splitTail(罁壍: string, 鸰壍 = 18): [
    string,
    string
] {
    if (罁壍.length <= 12)
        return [罁壍, ""];
    let 欟壍 = -1;
    for (let 討壍 = 罁壍.length - 1; 討壍 > 0; 討壍--) {
        const 国壍 = 罁壍.length - 討壍;
        if (国壍 > 鸰壍)
            break;
        if (国壍 >= 4 && 恒壍.test(罁壍.charAt(討壍)))
            欟壍 = 討壍;
    }
    return 欟壍 > 0 ? [罁壍.slice(0, 欟壍), 罁壍.slice(欟壍)] : [罁壍, ""];
}
export function middleEllipsis(痬壍: string, 铛壍: number): string {
    if (痬壍.length <= 铛壍)
        return 痬壍;
    const [, 懊壍] = splitTail(痬壍, Math.max(6, Math.floor(铛壍 * 0.6)));
    const 肹壍 = 懊壍 || 痬壍.slice(-Math.floor(铛壍 / 2));
    return `${痬壍.slice(0, Math.max(1, 铛壍 - 肹壍.length - 1))}…${肹壍}`;
}
export function MiddleTruncate({ text: 龨壍, className: 沗壍 }: {
    text: string;
    className?: string;
}) {
    const [讆壍, 塵壍] = splitTail(龨壍);
    if (!塵壍) {
        return (<span className={cn("block min-w-0 truncate", 沗壍)} title={龨壍}>
        {龨壍}
      </span>);
    }
    return (<span className={cn("flex min-w-0", 沗壍)} title={龨壍}>
      <span className="min-w-[2.5ch] overflow-hidden text-ellipsis whitespace-pre">{讆壍}</span>
      <span className="min-w-0 shrink-[0.001] overflow-hidden text-ellipsis whitespace-pre">{塵壍}</span>
    </span>);
}
