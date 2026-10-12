// Chroma captcha: a 5×5 sliding colour puzzle that stands in front of every app page (asked for 2026-10-12).
// Each tile is one cell of a smooth colour field mixed from four vivid corners; there are no numbers, so the
// only way back is reading the gradient. Every issued board is solvable (it is a random walk from the solved
// board), it is just long and subtle. Pure: no clock, no randomness of its own — pass an rng in.

export const CHROMA_SIZE = 5;
export const CHROMA_CELLS = CHROMA_SIZE * CHROMA_SIZE;
export const CHROMA_GAP = 0;
export const CHROMA_MAX_MOVES = 20_000;
/** Peeks at the finished picture per board (UI only; the server doesn't care how you solved it). */
export const CHROMA_PEEKS = 3;

/** index = cell (row-major), value = tile 1…24, or 0 for the gap. */
export type ChromaBoard = number[];

export const CHROMA_SOLVED: readonly number[] = Object.freeze([...Array.from({ length: CHROMA_CELLS - 1 }, (_, i) => i + 1), CHROMA_GAP]);

/** Cell where a tile belongs (the gap belongs bottom-right). */
export function chromaHome(tile: number): number {
  return tile === CHROMA_GAP ? CHROMA_CELLS - 1 : tile - 1;
}

export function isChromaBoard(value: unknown): value is ChromaBoard {
  if (!Array.isArray(value) || value.length !== CHROMA_CELLS) return false;
  const seen = new Set<number>();
  for (const cell of value) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= CHROMA_CELLS || seen.has(cell)) return false;
    seen.add(cell);
  }
  return true;
}

export function isChromaSolved(board: readonly number[]): boolean {
  return board.length === CHROMA_CELLS && board.every((tile, i) => tile === CHROMA_SOLVED[i]);
}

function permutationParity(board: readonly number[]): 0 | 1 {
  const visited = new Array<boolean>(CHROMA_CELLS).fill(false);
  let cycles = 0;
  for (let start = 0; start < CHROMA_CELLS; start++) {
    if (visited[start]) continue;
    cycles++;
    for (let i = start; !visited[i]; i = chromaHome(board[i]!)) visited[i] = true;
  }
  return ((CHROMA_CELLS - cycles) % 2) as 0 | 1;
}

function gapDistance(board: readonly number[]): number {
  const at = board.indexOf(CHROMA_GAP);
  const home = chromaHome(CHROMA_GAP);
  return Math.abs(Math.floor(at / CHROMA_SIZE) - Math.floor(home / CHROMA_SIZE)) + Math.abs((at % CHROMA_SIZE) - (home % CHROMA_SIZE));
}

/** (permutation parity + gap's taxicab distance from home) mod 2. A move flips both terms; 0 = reachable. */
export function isChromaSolvable(board: readonly number[]): boolean {
  return (permutationParity(board) + gapDistance(board)) % 2 === 0;
}

function neighbours(index: number): number[] {
  const row = Math.floor(index / CHROMA_SIZE);
  const col = index % CHROMA_SIZE;
  const out: number[] = [];
  if (row > 0) out.push(index - CHROMA_SIZE);
  if (row < CHROMA_SIZE - 1) out.push(index + CHROMA_SIZE);
  if (col > 0) out.push(index - 1);
  if (col < CHROMA_SIZE - 1) out.push(index + 1);
  return out;
}

export function chromaMovable(board: readonly number[]): number[] {
  return neighbours(board.indexOf(CHROMA_GAP)).map((i) => board[i]!);
}

/** Slides a tile next to the gap into it; null when the move is illegal. */
export function chromaSlide(board: readonly number[], tile: number): ChromaBoard | null {
  if (tile === CHROMA_GAP) return null;
  const gapAt = board.indexOf(CHROMA_GAP);
  const tileAt = board.indexOf(tile);
  if (tileAt < 0 || !neighbours(gapAt).includes(tileAt)) return null;
  const next = [...board];
  next[gapAt] = tile;
  next[tileAt] = CHROMA_GAP;
  return next;
}

export function chromaReplay(board: readonly number[], moves: readonly number[]): { board: ChromaBoard; illegalAt: number | null } {
  let current: ChromaBoard = [...board];
  for (let i = 0; i < moves.length; i++) {
    const next = chromaSlide(current, moves[i]!);
    if (!next) return { board: current, illegalAt: i };
    current = next;
  }
  return { board: current, illegalAt: null };
}

/** Sum of every tile's taxicab distance from home (the gap excluded). */
export function chromaDisorder(board: readonly number[]): number {
  let sum = 0;
  board.forEach((tile, at) => {
    if (tile === CHROMA_GAP) return;
    const home = chromaHome(tile);
    sum += Math.abs(Math.floor(at / CHROMA_SIZE) - Math.floor(home / CHROMA_SIZE)) + Math.abs((at % CHROMA_SIZE) - (home % CHROMA_SIZE));
  });
  return sum;
}

export const CHROMA_MIN_DISORDER = 64;

/**
 * A random walk from the solved board (no immediate back-steps), continued until the tiles are well mixed.
 * Only legal moves are made, so the result is always solvable.
 */
export function scrambleChroma(rng: () => number, opts: { steps?: number; minDisorder?: number } = {}): ChromaBoard {
  const steps = opts.steps ?? 720;
  const minDisorder = opts.minDisorder ?? CHROMA_MIN_DISORDER;
  let board: ChromaBoard = [...CHROMA_SOLVED];
  let previous = CHROMA_GAP;
  for (let i = 0; i < steps || chromaDisorder(board) < minDisorder || isChromaSolved(board); i++) {
    const options = chromaMovable(board).filter((tile) => tile !== previous);
    const tile = options[Math.floor(rng() * options.length)] ?? options[0]!;
    board = chromaSlide(board, tile)!;
    previous = tile;
    if (i > steps * 20) break; // safety valve; a 5×5 walk is mixed long before this
  }
  return board;
}

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────

type Lch = readonly [l: number, c: number, h: number];

export interface ChromaPalette {
  name: string;
  /** OKLCH corners: top-left, top-right, bottom-left, bottom-right. */
  corners: readonly [Lch, Lch, Lch, Lch];
}

export const CHROMA_PALETTES: readonly ChromaPalette[] = [
  { name: "Tropical dusk", corners: [[0.62, 0.24, 350], [0.85, 0.17, 95], [0.48, 0.2, 280], [0.78, 0.14, 175]] },
  { name: "Coral reef", corners: [[0.7, 0.19, 35], [0.83, 0.15, 135], [0.52, 0.22, 320], [0.66, 0.13, 220]] },
  { name: "Aurora", corners: [[0.82, 0.17, 150], [0.6, 0.23, 330], [0.55, 0.16, 240], [0.86, 0.16, 85]] },
  { name: "Candy shop", corners: [[0.74, 0.18, 0], [0.7, 0.16, 250], [0.88, 0.16, 105], [0.72, 0.15, 165]] },
  { name: "Neon market", corners: [[0.88, 0.18, 120], [0.64, 0.25, 15], [0.6, 0.2, 290], [0.75, 0.14, 210]] },
  { name: "Sunset glass", corners: [[0.58, 0.21, 300], [0.78, 0.16, 60], [0.7, 0.14, 200], [0.66, 0.23, 20]] },
];

function toLab([l, c, h]: Lch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** The tile's colour as a CSS `oklch()` string: its home cell's spot on a bilinear blend (in OKLab) of the corners. */
export function chromaTileColor(tile: number, paletteIndex: number): string {
  const palette = CHROMA_PALETTES[((paletteIndex % CHROMA_PALETTES.length) + CHROMA_PALETTES.length) % CHROMA_PALETTES.length]!;
  const home = chromaHome(tile);
  const u = (home % CHROMA_SIZE) / (CHROMA_SIZE - 1);
  const v = Math.floor(home / CHROMA_SIZE) / (CHROMA_SIZE - 1);
  const [tl, tr, bl, br] = palette.corners.map(toLab) as [number, number, number][];
  const mix = (k: 0 | 1 | 2) => (1 - v) * ((1 - u) * tl![k] + u * tr![k]) + v * ((1 - u) * bl![k] + u * br![k]);
  const l = mix(0);
  const a = mix(1);
  const b = mix(2);
  const c = Math.sqrt(a * a + b * b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return `oklch(${r3(l)} ${r3(c)} ${r3(h)})`;
}

/** Arrow keys move the tile on the opposite side of the gap into it (like pushing the tile). */
const ARROW_OFFSET: Record<string, number> = { ArrowUp: CHROMA_SIZE, ArrowDown: -CHROMA_SIZE, ArrowLeft: 1, ArrowRight: -1 };

export function chromaTileForArrow(board: readonly number[], key: string): number | null {
  const offset = ARROW_OFFSET[key];
  if (offset === undefined) return null;
  const gapAt = board.indexOf(CHROMA_GAP);
  const from = gapAt + offset;
  if (from < 0 || from >= board.length) return null;
  if (Math.abs(offset) === 1 && Math.floor(from / CHROMA_SIZE) !== Math.floor(gapAt / CHROMA_SIZE)) return null;
  return board[from] ?? null;
}
