"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Eyebrow, Headline } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/lib/api/client";
import { useCaptcha, useCaptchaVerify } from "@/lib/api/captcha";
import {
  CHROMA_CELLS,
  CHROMA_GAP,
  CHROMA_MAX_MOVES,
  CHROMA_PEEKS,
  CHROMA_SIZE,
  CHROMA_SOLVED,
  chromaMovable,
  chromaReplay,
  chromaSlide,
  chromaTileColor,
  chromaTileForArrow,
  isChromaSolved,
  type ChromaBoard,
} from "@/lib/domain/captcha/chroma";
import type { CaptchaChallenge } from "@/lib/domain/contracts/captcha";
import { CAPTCHA_PROGRESS_KEY, useTamperGuard } from "./use-tamper-guard";

/**
 * The human check that stands in front of every app page. The server renders this instead of the page until
 * the session has solved the colour puzzle, so removing the overlay reveals nothing; the guard signs people out
 * when they try.
 */
export function CaptchaGate() {
  const rootRef = useRef<HTMLDivElement>(null);
  const captcha = useCaptcha();
  const [done, setDone] = useState(false);
  useTamperGuard(rootRef, !done);
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, []);
  const palette = captcha.data?.challenge?.palette ?? 0;
  const passedElsewhere = captcha.data?.passed === true;
  useEffect(() => {
    if (passedElsewhere) window.location.reload();
  }, [passedElsewhere]);
  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[2147483000] overflow-y-auto bg-page"
      style={{ position: "fixed", inset: 0, zIndex: 2147483000 }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Backdrop palette={palette} />
      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
        {captcha.data?.challenge ? (
          <ChromaPlay
            key={captcha.data.challenge.token}
            challenge={captcha.data.challenge}
            onNewBoard={() => {
              clearProgress();
              void captcha.refetch();
            }}
            refreshing={captcha.isFetching}
            onDone={() => setDone(true)}
          />
        ) : (
          <ModalCard>
            <Eyebrow>Human check</Eyebrow>
            <Headline text="Mixing the *colours*" size={30} />
            {captcha.error ? (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-[13px] text-crit">{captcha.error.message}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="xs" onClick={() => void captcha.refetch()}>
                    Try again
                  </Button>
                  <SignOutButton />
                </div>
              </div>
            ) : (
              <p className="meta m-0">{passedElsewhere ? "Already solved — opening…" : "Shuffling a fresh board…"}</p>
            )}
          </ModalCard>
        )}
      </div>
    </div>
  );
}

function ModalCard({ children, labelledBy }: { children: React.ReactNode; labelledBy?: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="relative flex w-full max-w-[880px] flex-col gap-5 rounded-[22px] border border-line bg-card p-6 shadow-card sm:p-8"
    >
      {children}
    </div>
  );
}

interface Progress {
  token: string;
  moves: number[];
}

function readProgress(token: string): number[] {
  try {
    const raw = window.sessionStorage.getItem(CAPTCHA_PROGRESS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Progress) : null;
    return parsed && parsed.token === token && Array.isArray(parsed.moves) ? parsed.moves.slice(0, CHROMA_MAX_MOVES) : [];
  } catch {
    return [];
  }
}

function saveProgress(progress: Progress): void {
  try {
    window.sessionStorage.setItem(CAPTCHA_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage may be blocked */
  }
}

function clearProgress(): void {
  try {
    window.sessionStorage.removeItem(CAPTCHA_PROGRESS_KEY);
  } catch {
    /* storage may be blocked */
  }
}

function initialPlay(challenge: CaptchaChallenge): { board: ChromaBoard; moves: number[] } {
  if (typeof window === "undefined") return { board: challenge.board, moves: [] };
  const saved = readProgress(challenge.token);
  const played = chromaReplay(challenge.board, saved);
  return played.illegalAt === null ? { board: played.board, moves: saved } : { board: challenge.board, moves: [] };
}

function useElapsed(): number {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - started) / 1000));
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function ChromaPlay({ challenge, onNewBoard, refreshing, onDone }: { challenge: CaptchaChallenge; onNewBoard: () => void; refreshing: boolean; onDone: () => void }) {
  const titleId = useId();
  const [{ board, moves }, setPlay] = useState(() => initialPlay(challenge));
  const [peeksLeft, setPeeksLeft] = useState(CHROMA_PEEKS);
  const [peeking, setPeeking] = useState(false);
  const verify = useCaptchaVerify();
  const elapsed = useElapsed();
  const solvedLocally = isChromaSolved(board);
  const full = moves.length >= CHROMA_MAX_MOVES;

  const submit = (finalMoves: number[]) =>
    verify.mutate(
      { token: challenge.token, moves: finalMoves },
      {
        onSuccess: () => {
          clearProgress();
          onDone();
          window.setTimeout(() => window.location.reload(), 900);
        },
      },
    );

  const onSlide = (tile: number) => {
    if (verify.isPending || verify.isSuccess || full || peeking) return;
    const next = chromaSlide(board, tile);
    if (!next) return;
    const nextMoves = [...moves, tile];
    setPlay({ board: next, moves: nextMoves });
    saveProgress({ token: challenge.token, moves: nextMoves });
    if (verify.isError) verify.reset();
    if (isChromaSolved(next)) submit(nextMoves);
  };

  const restart = () => {
    setPlay({ board: challenge.board, moves: [] });
    clearProgress();
    verify.reset();
  };

  const peek = () => {
    if (peeksLeft <= 0 || peeking) return;
    setPeeksLeft((n) => n - 1);
    setPeeking(true);
    window.setTimeout(() => setPeeking(false), 1600);
  };

  const failure = verify.error instanceof ApiError ? verify.error : null;
  const reason = (failure?.details as { reason?: string } | undefined)?.reason;
  const stale = reason === "captcha_expired" || reason === "captcha_invalid";
  const corners = useMemo(() => [1, CHROMA_SIZE, CHROMA_CELLS - CHROMA_SIZE + 1, CHROMA_GAP].map((tile) => chromaTileColor(tile, challenge.palette)), [challenge.palette]);
  const expires = new Date(challenge.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <ModalCard labelledBy={titleId}>
      <div className="grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center">
        <div className="flex flex-col gap-4">
          <Eyebrow>Human check · once per session</Eyebrow>
          <div id={titleId}>
            <Headline text="Restore the *spectrum*" size={36} />
          </div>
          <p className="m-0 text-sm leading-relaxed text-muted">
            Twenty-four tiles were cut from one smooth colour field and shuffled. Slide them into the gap until the colours flow evenly between the
            four corner swatches. No numbers, no outlines — just your eyes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip>{challenge.paletteName}</Chip>
            <Chip>{`${moves.length.toLocaleString("en-US")} move${moves.length === 1 ? "" : "s"}`}</Chip>
            <Chip>{clock(elapsed)}</Chip>
            <Chip>{`${peeksLeft} peek${peeksLeft === 1 ? "" : "s"} left`}</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="xs" onClick={peek} disabled={peeksLeft <= 0 || peeking || verify.isSuccess}>
              {peeking ? "Peeking…" : "Peek at the picture"}
            </Button>
            <Button variant="ghost" size="xs" onClick={restart} disabled={moves.length === 0 || verify.isPending || verify.isSuccess}>
              Start over
            </Button>
            <Button variant="ghost" size="xs" onClick={onNewBoard} loading={refreshing} disabled={verify.isPending || verify.isSuccess}>
              New board
            </Button>
            <SignOutButton />
          </div>
          <div aria-live="polite" className="min-h-5 text-[13px]">
            {verify.isSuccess ? (
              <span className="text-accent">Spectrum restored. Opening your dashboard…</span>
            ) : verify.isPending ? (
              <span className="text-muted">Checking your moves with the server…</span>
            ) : failure ? (
              <span className="flex flex-wrap items-center gap-2 text-crit">
                {failure.message}
                {stale ? (
                  <Button variant="link" size="xs" onClick={onNewBoard}>
                    Load a new board
                  </Button>
                ) : null}
              </span>
            ) : verify.error ? (
              <span className="text-crit">{verify.error.message}</span>
            ) : solvedLocally ? (
              <Button variant="brand" size="xs" onClick={() => submit(moves)}>
                Check again
              </Button>
            ) : full ? (
              <span className="text-crit">Move limit reached — start over or load a new board.</span>
            ) : null}
          </div>
          <p className="meta m-0">{`Board expires at ${expires}. Opening developer tools or hiding this check signs you out.`}</p>
        </div>
        <div className="flex justify-center">
          <ChromaBoardView board={board} palette={challenge.palette} corners={corners} peeking={peeking} solved={verify.isSuccess} disabled={verify.isPending || verify.isSuccess || full} onSlide={onSlide} />
        </div>
      </div>
    </ModalCard>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-pill border border-line bg-deep px-2.5 py-1 font-mono text-[11px] text-muted tabular-nums">{children}</span>;
}

function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="xs"
      loading={busy}
      onClick={() => {
        setBusy(true);
        clearProgress();
        void fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin" })
          .catch(() => undefined)
          .finally(() => window.location.replace("/login"));
      }}
    >
      Sign out
    </Button>
  );
}

const SOLVED_TILES = CHROMA_SOLVED.filter((tile) => tile !== CHROMA_GAP);
const pct = 100 / CHROMA_SIZE;

function ChromaBoardView({
  board,
  palette,
  corners,
  peeking,
  solved,
  disabled,
  onSlide,
}: {
  board: ChromaBoard;
  palette: number;
  corners: string[];
  peeking: boolean;
  solved: boolean;
  disabled: boolean;
  onSlide: (tile: number) => void;
}) {
  const movable = new Set(chromaMovable(board));
  const gapAt = board.indexOf(CHROMA_GAP);
  return (
    <div className="relative w-full max-w-[360px] p-3">
      {corners.map((color, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "absolute size-5 rounded-full border-2 border-deep shadow-[0_2px_8px_rgba(0,0,0,0.25)]",
            i === 0 && "top-0 left-0",
            i === 1 && "top-0 right-0",
            i === 2 && "bottom-0 left-0",
            i === 3 && "right-0 bottom-0",
          )}
          style={{ background: color }}
        />
      ))}
      <div
        role="group"
        tabIndex={0}
        aria-label="Colour sliding puzzle, 5 by 5. Arrow keys slide a tile into the gap. Restore the smooth gradient between the corner swatches."
        className={cn(
          "relative aspect-square w-full rounded-[18px] bg-tone/6 p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          solved && "ring-2 ring-accent/70",
        )}
        onKeyDown={(event) => {
          if (disabled) return;
          const tile = chromaTileForArrow(board, event.key);
          if (tile === null) return;
          event.preventDefault();
          onSlide(tile);
        }}
      >
        <div className="relative size-full">
          <div
            aria-hidden
            className="absolute rounded-[10px] border border-dashed border-line-strong"
            style={{ width: `calc(${pct}% - 6px)`, height: `calc(${pct}% - 6px)`, left: `calc(${(gapAt % CHROMA_SIZE) * pct}% + 3px)`, top: `calc(${Math.floor(gapAt / CHROMA_SIZE) * pct}% + 3px)` }}
          />
          {SOLVED_TILES.map((tile) => {
            const at = board.indexOf(tile);
            const row = Math.floor(at / CHROMA_SIZE);
            const col = at % CHROMA_SIZE;
            const canMove = movable.has(tile) && !disabled;
            return (
              <div
                key={tile}
                className="absolute top-0 left-0 p-[3px] transition-transform duration-150 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%`, height: `${pct}%`, transform: `translate(${col * 100}%, ${row * 100}%)` }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={!canMove}
                  aria-label={canMove ? "Colour tile next to the gap, slide it in" : "Colour tile"}
                  onClick={() => onSlide(tile)}
                  className={cn(
                    "relative block size-full overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.12)] transition-transform select-none",
                    canMove ? "cursor-pointer hover:scale-[1.04] active:scale-95" : "cursor-default",
                  )}
                  style={{ background: chromaTileColor(tile, palette) }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.28),transparent_46%)]" />
                </button>
              </div>
            );
          })}
          {peeking ? (
            <div aria-hidden className="absolute inset-0 grid grid-cols-5 grid-rows-5 animate-fade-up-fast rounded-[12px] bg-deep/40 backdrop-blur-[1px]">
              {CHROMA_SOLVED.map((tile) => (
                <div key={tile} className="p-[3px]">
                  {tile === CHROMA_GAP ? null : <div className="size-full rounded-[10px]" style={{ background: chromaTileColor(tile, palette) }} />}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Decorative only: soft colour light and a faceless dashboard silhouette. No data is on the page. */
function Backdrop({ palette }: { palette: number }) {
  const blobs = [1, CHROMA_SIZE, CHROMA_CELLS - CHROMA_SIZE + 1, CHROMA_GAP].map((tile) => chromaTileColor(tile, palette));
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full opacity-35 blur-[90px]" style={{ background: blobs[0] }} />
      <div className="absolute -top-32 -right-40 size-[480px] rounded-full opacity-30 blur-[90px]" style={{ background: blobs[1] }} />
      <div className="absolute -bottom-48 -left-24 size-[520px] rounded-full opacity-30 blur-[100px]" style={{ background: blobs[2] }} />
      <div className="absolute -right-32 -bottom-40 size-[500px] rounded-full opacity-35 blur-[90px]" style={{ background: blobs[3] }} />
      <div className="absolute inset-0 flex gap-6 p-6 opacity-50 blur-[6px]">
        <div className="hidden w-56 shrink-0 flex-col gap-3 rounded-[18px] bg-tone/6 p-5 lg:flex">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="h-3 rounded-full bg-tone/10" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <div className="h-10 w-2/5 rounded-full bg-tone/8" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 rounded-[16px] bg-tone/6" />
            ))}
          </div>
          <div className="h-64 rounded-[18px] bg-tone/6" />
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-[18px] bg-tone/6" />
            <div className="rounded-[18px] bg-tone/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
