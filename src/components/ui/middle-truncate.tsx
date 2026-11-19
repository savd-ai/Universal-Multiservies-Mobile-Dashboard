import { cn } from "./cn";

// Campaign names often share a long prefix ("Agency_Client_Google_NB_zines", "Agency_Client_Google_NB_posters"…),
// so plain end-truncation makes every row read the same. MiddleTruncate keeps the distinguishing tail visible: the
// head shrinks with an ellipsis, the last segment(s) never do. Screen readers and copy/paste get the whole name (the
// two spans are adjacent text) and the title shows it on hover.

const SEPARATOR = /[\s_\-|/·—–.:,]/;

/** [head, tail]: the tail is the longest run of trailing segments (from a separator) of 4–`max` characters, else "". */
export function splitTail(text: string, max = 18): [string, string] {
  if (text.length <= 12) return [text, ""];
  let at = -1;
  for (let i = text.length - 1; i > 0; i--) {
    const len = text.length - i;
    if (len > max) break;
    if (len >= 4 && SEPARATOR.test(text.charAt(i))) at = i;
  }
  return at > 0 ? [text.slice(0, at), text.slice(at)] : [text, ""];
}

/** Character-based middle ellipsis for canvas text (chart axis labels): "Agency_Client_Google_NB_zines" → "Agency_Cli…NB_zines". */
export function middleEllipsis(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const [, tail] = splitTail(text, Math.max(6, Math.floor(maxChars * 0.6)));
  const keep = tail || text.slice(-Math.floor(maxChars / 2));
  return `${text.slice(0, Math.max(1, maxChars - keep.length - 1))}…${keep}`;
}

/** A name that truncates in the middle (see above); `className` styles the text (font, color, flex sizing). */
export function MiddleTruncate({ text, className }: { text: string; className?: string }) {
  const [head, tail] = splitTail(text);
  if (!tail) {
    return (
      <span className={cn("block min-w-0 truncate", className)} title={text}>
        {text}
      </span>
    );
  }
  // Spaces are preserved (a head ending in a space kept "Search — …" from reading "Search— …"). The head keeps its
  // first letter and the ellipsis; only then does the tail give way (its tiny shrink factor makes it shrink last).
  return (
    <span className={cn("flex min-w-0", className)} title={text}>
      <span className="min-w-[2.5ch] overflow-hidden text-ellipsis whitespace-pre">{head}</span>
      <span className="min-w-0 shrink-[0.001] overflow-hidden text-ellipsis whitespace-pre">{tail}</span>
    </span>
  );
}
