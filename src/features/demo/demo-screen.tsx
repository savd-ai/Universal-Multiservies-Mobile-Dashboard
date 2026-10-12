"use client";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/inputs";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, MetaStat, MiniCard } from "@/components/ui/surfaces";
import { ApiError } from "@/lib/api/client";
import { useDemoLock, useDemoUnlock } from "@/lib/api/demo";
import { DEMO_MAX_MOVES, DEMO_TABLES, type DemoLockedDetails, type DemoLockStatus } from "@/lib/domain/contracts/demo";
import { formatLong } from "@/lib/domain/dates";
import { isSolved, slide, type Board } from "@/lib/domain/demo/puzzle";
import { DemoDashboard } from "./demo-dashboard";
import { SlidePuzzle } from "./slide-puzzle";
const PUZZLE_TEXT: Record<DemoLockedDetails["puzzle"], string> = {
    solved: "Puzzle 1 · solved.",
    unsolved: "Puzzle 1 · the tiles aren't in order yet.",
    illegal_move: "Puzzle 1 · a move broke the rules. Start over.",
};
const KEY_TEXT: Record<DemoLockedDetails["key"], string> = {
    correct: "Puzzle 2 · key accepted.",
    incorrect: "Puzzle 2 · that key's SHA-256 doesn't match.",
    malformed: "Puzzle 2 · the key is 64 hex characters (0–9, a–f).",
};
export function DemoScreen() {
    const lock = useDemoLock();
    const unlock = useDemoUnlock();
    return (<div className="flex flex-col gap-6">
      <PageHeader />
      {unlock.data ? (<DemoDashboard data={unlock.data}/>) : lock.error && !lock.data ? (<ErrorState error={lock.error} onRetry={() => void lock.refetch()}/>) : !lock.data ? (<Card>
          <SkeletonLines lines={6}/>
        </Card>) : (<DemoGate key={lock.data.challenge.token} status={lock.data} unlock={unlock} refreshing={lock.isFetching} onNewBoard={() => {
                unlock.reset();
                void lock.refetch();
            }}/>)}
    </div>);
}
function DemoGate({ status, unlock, refreshing, onNewBoard }: {
    status: DemoLockStatus;
    unlock: ReturnType<typeof useDemoUnlock>;
    refreshing: boolean;
    onNewBoard: () => void;
}) {
    const [board, setBoard] = useState<Board>(status.challenge.board);
    const [moves, setMoves] = useState<number[]>([]);
    const [key, setKey] = useState("");
    const full = moves.length >= DEMO_MAX_MOVES;
    const onSlide = (tile: number) => {
        const next = slide(board, tile);
        if (!next || full)
            return;
        setBoard(next);
        setMoves((previous) => [...previous, tile]);
        unlock.reset();
    };
    const restart = () => {
        setBoard(status.challenge.board);
        setMoves([]);
        unlock.reset();
    };
    const failure = unlock.error instanceof ApiError ? unlock.error : null;
    const details = failure?.details as Partial<DemoLockedDetails> | {
        reason?: string;
    } | undefined;
    const locked = details?.reason === "demo_locked" ? (details as DemoLockedDetails) : null;
    const staleBoard = details?.reason === "demo_challenge_expired" || details?.reason === "demo_challenge_invalid";
    if (!status.available) {
        return (<EmptyState>
        {status.note ?? "The demo database is not available."}
      </EmptyState>);
    }
    return (<div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Puzzle 1 · Slide the tiles" sub="Put 1–15 in order with the gap last. Click a tile next to the gap, or focus the board and use the arrow keys." action={<Pill tone={isSolved(board) ? "accent" : "muted"}>{isSolved(board) ? "In order" : "Not in order"}</Pill>}/>
          <div className="flex justify-center">
            <SlidePuzzle board={board} onSlide={onSlide} disabled={unlock.isPending || full}/>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="meta flex-1">{`${moves.length.toLocaleString("en-US")} move${moves.length === 1 ? "" : "s"}${full ? " · move limit reached" : ""}`}</span>
            <Button variant="ghost" size="xs" onClick={restart} disabled={moves.length === 0}>
              Start over
            </Button>
            <Button variant="ghost" size="xs" onClick={onNewBoard} loading={refreshing}>
              New board
            </Button>
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <CardHeader title="Puzzle 2 · The vault key" sub="The demo tables are encrypted with a 256-bit key. Enter the key whose SHA-256 is the value below." action={<Pill tone="muted">{`${key.length}/64`}</Pill>}/>
          <code className="block rounded-mini border border-line bg-deep p-3.5 font-mono text-xs leading-relaxed break-all text-muted">{status.keySha256}</code>
          <Field label="Key (hex)" hint="64 characters, 0–9 and a–f.">
            {(id) => (<Input id={id} variant="field" value={key} maxLength={256} spellCheck={false} autoComplete="off" autoCapitalize="off" className="font-mono text-base sm:text-[13px]" placeholder="0000…" onChange={(event) => {
                    setKey(event.target.value);
                    unlock.reset();
                }}/>)}
          </Field>
        </Card>
      </div>
      <Card className="flex flex-col gap-4">
        <CardHeader title="Open the demo dashboard" sub="The server checks both answers. The page has none of the demo values until the server opens the tables."/>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" loading={unlock.isPending} onClick={() => unlock.mutate({ token: status.challenge.token, moves, key })}>
            Open dashboard
          </Button>
          {staleBoard ? (<Button variant="ghost" size="xs" onClick={onNewBoard}>
              Load a new board
            </Button>) : null}
        </div>
        {locked ? (<ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-muted" aria-live="polite">
            <li className={locked.puzzle === "solved" ? "text-accent" : "text-crit"}>{PUZZLE_TEXT[locked.puzzle]}</li>
            <li className={locked.key === "correct" ? "text-accent" : "text-crit"}>{KEY_TEXT[locked.key]}</li>
          </ul>) : failure ? (<p className="m-0 text-[13px] text-crit" aria-live="polite">{failure.message}</p>) : unlock.error ? (<ErrorState error={unlock.error} compact/>) : null}
      </Card>
      <Card className="flex flex-col gap-4">
        <CardHeader title="What's inside" sub="demo/demo-dashboard.sqlite" action={<Pill tone="muted">Sealed</Pill>}/>
        <div className="flex flex-wrap gap-6">
          <MetaStat label="Cipher" value={status.cipher?.toUpperCase() ?? "—"}/>
          <MetaStat label="Sealed" value={status.sealedAt ? formatLong(status.sealedAt.slice(0, 10)) : "—"}/>
          <MetaStat label="Rows" value={status.tables.reduce((sum, table) => sum + table.rows, 0).toLocaleString("en-US")}/>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {status.tables.map((table) => (<MiniCard key={table.name} className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-fg">{table.name}</span>
              <span className="meta">{`${DEMO_TABLES.find((known) => known.name === table.name)?.label ?? table.name} · ${table.rows.toLocaleString("en-US")} row${table.rows === 1 ? "" : "s"}`}</span>
              <span className="text-xs leading-normal text-muted-3">{table.columns.join(" · ")}</span>
            </MiniCard>))}
        </div>
      </Card>
    </div>);
}
