export const PUZZLE_SIZE = 4;
export const PUZZLE_CELLS = PUZZLE_SIZE * PUZZLE_SIZE;
export const BLANK = 0;
export type Board = readonly number[];
export const SOLVED_BOARD: Board = [...Array.from({ length: PUZZLE_CELLS - 1 }, (_, i) => i + 1), BLANK];
export const LOYD_BOARD: Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, BLANK];
export function isBoard(board: readonly unknown[]): board is Board {
    if (board.length !== PUZZLE_CELLS)
        return false;
    const seen = new Set<unknown>(board);
    return seen.size === PUZZLE_CELLS && SOLVED_BOARD.every((tile) => seen.has(tile));
}
export function isSolved(board: Board): boolean {
    return board.every((tile, i) => tile === SOLVED_BOARD[i]);
}
function home(tile: number): number {
    return tile === BLANK ? PUZZLE_CELLS - 1 : tile - 1;
}
function permutationParity(board: Board): 0 | 1 {
    const visited = new Array<boolean>(PUZZLE_CELLS).fill(false);
    let cycles = 0;
    for (let start = 0; start < PUZZLE_CELLS; start++) {
        if (visited[start])
            continue;
        cycles++;
        for (let i = start; !visited[i]; i = home(board[i]!))
            visited[i] = true;
    }
    return ((PUZZLE_CELLS - cycles) % 2) as 0 | 1;
}
function blankDistance(board: Board): number {
    const at = board.indexOf(BLANK);
    const homeAt = home(BLANK);
    return Math.abs(Math.floor(at / PUZZLE_SIZE) - Math.floor(homeAt / PUZZLE_SIZE)) + Math.abs((at % PUZZLE_SIZE) - (homeAt % PUZZLE_SIZE));
}
export function solvabilityParity(board: Board): 0 | 1 {
    return ((permutationParity(board) + blankDistance(board)) % 2) as 0 | 1;
}
export function isSolvable(board: Board): boolean {
    return solvabilityParity(board) === 0;
}
function neighbours(index: number): number[] {
    const row = Math.floor(index / PUZZLE_SIZE);
    const col = index % PUZZLE_SIZE;
    const out: number[] = [];
    if (row > 0)
        out.push(index - PUZZLE_SIZE);
    if (row < PUZZLE_SIZE - 1)
        out.push(index + PUZZLE_SIZE);
    if (col > 0)
        out.push(index - 1);
    if (col < PUZZLE_SIZE - 1)
        out.push(index + 1);
    return out;
}
export function movableTiles(board: Board): number[] {
    return neighbours(board.indexOf(BLANK)).map((i) => board[i]!);
}
export function slide(board: Board, tile: number): Board | null {
    if (tile === BLANK)
        return null;
    const blankAt = board.indexOf(BLANK);
    const tileAt = board.indexOf(tile);
    if (tileAt < 0 || !neighbours(blankAt).includes(tileAt))
        return null;
    const next = [...board];
    next[blankAt] = tile;
    next[tileAt] = BLANK;
    return next;
}
export function replay(board: Board, moves: readonly number[]): {
    board: Board;
    illegalAt: number | null;
} {
    let current = board;
    for (let i = 0; i < moves.length; i++) {
        const next = slide(current, moves[i]!);
        if (!next)
            return { board: current, illegalAt: i };
        current = next;
    }
    return { board: current, illegalAt: null };
}
export function scrambleUnsolvable(rng: () => number, steps = 240): Board {
    let board: Board = SOLVED_BOARD;
    let previous = BLANK;
    for (let i = 0; i < steps; i++) {
        const options = movableTiles(board).filter((tile) => tile !== previous);
        const tile = options[Math.floor(rng() * options.length)]!;
        board = slide(board, tile)!;
        previous = tile;
    }
    const tiles = board.map((tile, i) => ({ tile, i })).filter((cell) => cell.tile !== BLANK);
    const first = tiles.splice(Math.floor(rng() * tiles.length), 1)[0]!;
    const second = tiles[Math.floor(rng() * tiles.length)]!;
    const swapped = [...board];
    swapped[first.i] = second.tile;
    swapped[second.i] = first.tile;
    return swapped;
}
