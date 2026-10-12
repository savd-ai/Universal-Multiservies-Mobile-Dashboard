import { describe, expect, it } from "vitest";
import {
  CHROMA_CELLS,
  CHROMA_GAP,
  CHROMA_MIN_DISORDER,
  CHROMA_PALETTES,
  CHROMA_SIZE,
  CHROMA_SOLVED,
  chromaDisorder,
  chromaMovable,
  chromaReplay,
  chromaSlide,
  chromaTileColor,
  chromaTileForArrow,
  isChromaBoard,
  isChromaSolvable,
  isChromaSolved,
  scrambleChroma,
} from "@/lib/domain/captcha/chroma";
import { mulberry32 } from "@/lib/domain/rng";

const solved = () => [...CHROMA_SOLVED];

describe("chroma captcha board", () => {
  it("starts solved and solvable", () => {
    expect(CHROMA_CELLS).toBe(25);
    expect(isChromaSolved(solved())).toBe(true);
    expect(isChromaSolvable(solved())).toBe(true);
    expect(chromaDisorder(solved())).toBe(0);
  });

  it("validates boards", () => {
    expect(isChromaBoard(solved())).toBe(true);
    expect(isChromaBoard(solved().slice(1))).toBe(false);
    expect(isChromaBoard([...solved().slice(0, 24), 3])).toBe(false);
    expect(isChromaBoard([...solved().slice(0, 24), 25])).toBe(false);
  });

  it("slides only tiles next to the gap", () => {
    expect(chromaMovable(solved()).sort((a, b) => a - b)).toEqual([20, 24]);
    expect(chromaSlide(solved(), 1)).toBeNull();
    expect(chromaSlide(solved(), CHROMA_GAP)).toBeNull();
    const next = chromaSlide(solved(), 24)!;
    expect(next[23]).toBe(CHROMA_GAP);
    expect(next[24]).toBe(24);
  });

  it("keeps the solvability invariant on every legal move", () => {
    const rng = mulberry32(7);
    let board = solved();
    for (let i = 0; i < 2000; i++) {
      const options = chromaMovable(board);
      board = chromaSlide(board, options[Math.floor(rng() * options.length)]!)!;
      expect(isChromaSolvable(board)).toBe(true);
    }
  });

  it("flags a single swap as unsolvable", () => {
    const board = solved();
    [board[0], board[1]] = [board[1]!, board[0]!];
    expect(isChromaSolvable(board)).toBe(false);
  });

  it("issues mixed, solvable, unsolved scrambles", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const board = scrambleChroma(mulberry32(seed));
      expect(isChromaBoard(board)).toBe(true);
      expect(isChromaSolvable(board)).toBe(true);
      expect(isChromaSolved(board)).toBe(false);
      expect(chromaDisorder(board)).toBeGreaterThanOrEqual(CHROMA_MIN_DISORDER);
    }
  });

  it("replays moves, stops at the first illegal one and solves by walking back", () => {
    const rng = mulberry32(42);
    let board = solved();
    const walk: number[] = [];
    for (let i = 0; i < 300; i++) {
      const options = chromaMovable(board).filter((tile) => tile !== walk.at(-1));
      const tile = options[Math.floor(rng() * options.length)]!;
      board = chromaSlide(board, tile)!;
      walk.push(tile);
    }
    expect(chromaReplay(solved(), walk).board).toEqual(board);
    expect(isChromaSolved(chromaReplay(board, [...walk].reverse()).board)).toBe(true);
    const bad = chromaReplay(board, [walk.at(-1)!, 999]);
    expect(bad.illegalAt).toBe(1);
  });

  it("maps arrow keys to the tile that slides into the gap", () => {
    expect(chromaTileForArrow(solved(), "ArrowDown")).toBe(20);
    expect(chromaTileForArrow(solved(), "ArrowRight")).toBe(24);
    expect(chromaTileForArrow(solved(), "ArrowUp")).toBeNull();
    expect(chromaTileForArrow(solved(), "ArrowLeft")).toBeNull();
    expect(chromaTileForArrow(solved(), "Enter")).toBeNull();
  });
});

describe("chroma colours", () => {
  const parse = (css: string) => css.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)!.slice(1).map(Number) as [number, number, number];
  const lab = ([l, c, h]: [number, number, number]) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
  const dist = (a: string, b: string) => {
    const [x, y] = [lab(parse(a)), lab(parse(b))];
    return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
  };

  it("gives every tile a distinct oklch colour in every palette", () => {
    for (let p = 0; p < CHROMA_PALETTES.length; p++) {
      const colours = CHROMA_SOLVED.map((tile) => chromaTileColor(tile, p));
      colours.forEach((css) => expect(css).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/));
      expect(new Set(colours).size).toBe(CHROMA_CELLS);
    }
  });

  it("is a smooth field: neighbours are closer than opposite corners, and the corners match the palette", () => {
    for (let p = 0; p < CHROMA_PALETTES.length; p++) {
      const at = (row: number, col: number) => chromaTileColor(row * CHROMA_SIZE + col + 1 === CHROMA_CELLS ? CHROMA_GAP : row * CHROMA_SIZE + col + 1, p);
      const span = dist(at(0, 0), at(CHROMA_SIZE - 1, CHROMA_SIZE - 1));
      for (let r = 0; r < CHROMA_SIZE; r++) {
        for (let c = 0; c < CHROMA_SIZE - 1; c++) {
          const step = dist(at(r, c), at(r, c + 1));
          expect(step).toBeGreaterThan(0.005);
          expect(step).toBeLessThan(span);
        }
      }
      const [l, ch, h] = CHROMA_PALETTES[p]!.corners[0];
      const [l2, c2, h2] = parse(at(0, 0));
      expect(l2).toBeCloseTo(l, 2);
      expect(c2).toBeCloseTo(ch, 2);
      expect(Math.abs(((h2 - h + 540) % 360) - 180)).toBeLessThan(0.5);
    }
  });
});
