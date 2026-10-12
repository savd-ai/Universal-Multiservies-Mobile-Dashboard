"use client";
import { cn } from "@/components/ui/cn";
import { BLANK, movableTiles, PUZZLE_SIZE, SOLVED_BOARD, type Board } from "@/lib/domain/demo/puzzle";
const ARROW_OFFSET: Record<string, number> = { ArrowUp: PUZZLE_SIZE, ArrowDown: -PUZZLE_SIZE, ArrowLeft: 1, ArrowRight: -1 };
export function tileForArrow(board: Board, key: string): number | null {
    const offset = ARROW_OFFSET[key];
    if (offset === undefined)
        return null;
    const blankAt = board.indexOf(BLANK);
    const from = blankAt + offset;
    if (from < 0 || from >= board.length)
        return null;
    if (Math.abs(offset) === 1 && Math.floor(from / PUZZLE_SIZE) !== Math.floor(blankAt / PUZZLE_SIZE))
        return null;
    return board[from] ?? null;
}
export function SlidePuzzle({ board, onSlide, disabled }: {
    board: Board;
    onSlide: (tile: number) => void;
    disabled?: boolean;
}) {
    const movable = new Set(movableTiles(board));
    return (<div role="group" aria-label="Sliding puzzle: put the tiles in order from 1 to 15 with the gap last. Arrow keys slide a tile into the gap." tabIndex={0} className="relative aspect-square w-full max-w-[288px] rounded-mini bg-tone/6 p-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/60" onKeyDown={(event) => {
            if (disabled)
                return;
            const tile = tileForArrow(board, event.key);
            if (tile === null)
                return;
            event.preventDefault();
            onSlide(tile);
        }}>
      <div className="relative size-full">
        {SOLVED_BOARD.filter((tile) => tile !== BLANK).map((tile) => {
            const at = board.indexOf(tile);
            const row = Math.floor(at / PUZZLE_SIZE);
            const col = at % PUZZLE_SIZE;
            const canMove = movable.has(tile) && !disabled;
            return (<div key={tile} className="absolute top-0 left-0 size-1/4 p-1 transition-transform duration-150 ease-out motion-reduce:transition-none" style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}>
              <button type="button" tabIndex={-1} disabled={!canMove} aria-label={canMove ? `Tile ${tile}, slide into the gap` : `Tile ${tile}`} onClick={() => onSlide(tile)} className={cn("grid size-full place-items-center rounded-mini border font-display text-xl font-semibold tracking-title select-none", tile === board[tile - 1] ? "border-teal/30 bg-card-accent text-accent" : "border-line bg-card text-fg", canMove ? "cursor-pointer hover:border-teal/60" : "cursor-default")}>
                {tile}
              </button>
            </div>);
        })}
      </div>
    </div>);
}
