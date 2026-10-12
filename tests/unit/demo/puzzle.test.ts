import { describe, expect, it } from "vitest";
import { BLANK, isBoard, isSolvable, isSolved, LOYD_BOARD, movableTiles, replay, scrambleUnsolvable, slide, solvabilityParity, SOLVED_BOARD, type Board } from "@/lib/domain/demo/puzzle";
import { seedRng } from "@/lib/domain/rng";
import { tileForArrow } from "@/features/demo/slide-puzzle";
function randomWalk(board: Board, rng: () => number, steps: number): {
    board: Board;
    moves: number[];
} {
    let current = board;
    const moves: number[] = [];
    for (let i = 0; i < steps; i++) {
        const options = movableTiles(current);
        const tile = options[Math.floor(rng() * options.length)]!;
        current = slide(current, tile)!;
        moves.push(tile);
    }
    return { board: current, moves };
}
describe("sliding puzzle", () => {
    it("knows the solved board and Sam Loyd's 14–15 board", () => {
        expect(isBoard(SOLVED_BOARD)).toBe(true);
        expect(isSolved(SOLVED_BOARD)).toBe(true);
        expect(solvabilityParity(SOLVED_BOARD)).toBe(0);
        expect(isSolved(LOYD_BOARD)).toBe(false);
        expect(solvabilityParity(LOYD_BOARD)).toBe(1);
        expect(isBoard([...SOLVED_BOARD.slice(0, 15), 15])).toBe(false);
        expect(isBoard(SOLVED_BOARD.slice(1))).toBe(false);
    });
    it("slides only tiles next to the gap", () => {
        expect(movableTiles(SOLVED_BOARD).sort((a, b) => a - b)).toEqual([12, 15]);
        expect(slide(SOLVED_BOARD, 15)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, BLANK, 15]);
        expect(slide(SOLVED_BOARD, 1)).toBeNull();
        expect(slide(SOLVED_BOARD, BLANK)).toBeNull();
        expect(slide(SOLVED_BOARD, 99)).toBeNull();
    });
    it("keeps the parity invariant on every legal move", () => {
        const rng = seedRng("demo-parity");
        for (const start of [SOLVED_BOARD, LOYD_BOARD, scrambleUnsolvable(rng)]) {
            const parity = solvabilityParity(start);
            let board = start;
            for (let i = 0; i < 400; i++) {
                const options = movableTiles(board);
                board = slide(board, options[Math.floor(rng() * options.length)]!)!;
                expect(solvabilityParity(board)).toBe(parity);
            }
        }
    });
    it("only ever issues boards that cannot be solved", () => {
        for (let seed = 0; seed < 500; seed++) {
            const board = scrambleUnsolvable(seedRng("demo-scramble", seed));
            expect(isBoard(board)).toBe(true);
            expect(isSolved(board)).toBe(false);
            expect(isSolvable(board)).toBe(false);
        }
    });
    it("never reaches the solved board from an unsolvable one, however long the play", () => {
        const rng = seedRng("demo-play");
        for (let game = 0; game < 50; game++) {
            let board = scrambleUnsolvable(rng);
            for (let i = 0; i < 4000; i++) {
                const options = movableTiles(board);
                board = slide(board, options[Math.floor(rng() * options.length)]!)!;
                expect(isSolved(board)).toBe(false);
            }
        }
    });
    it("replays moves, stops at the first illegal one and reports a solved board when there is one", () => {
        const rng = seedRng("demo-replay");
        const scrambled = randomWalk(SOLVED_BOARD, rng, 60);
        const undo = [...scrambled.moves].reverse();
        expect(isSolvable(scrambled.board)).toBe(true);
        expect(replay(scrambled.board, undo)).toEqual({ board: SOLVED_BOARD, illegalAt: null });
        const played = replay(SOLVED_BOARD, [15, 11, 99, 7]);
        expect(played.illegalAt).toBe(2);
        expect(played.board).toEqual(replay(SOLVED_BOARD, [15, 11]).board);
    });
    it("maps arrow keys to the tile that slides into the gap", () => {
        expect(tileForArrow(SOLVED_BOARD, "ArrowRight")).toBe(15);
        expect(tileForArrow(SOLVED_BOARD, "ArrowDown")).toBe(12);
        expect(tileForArrow(SOLVED_BOARD, "ArrowLeft")).toBeNull();
        expect(tileForArrow(SOLVED_BOARD, "ArrowUp")).toBeNull();
        expect(tileForArrow(SOLVED_BOARD, "Enter")).toBeNull();
        const gapLeftEdge = [1, 2, 3, 4, BLANK, 6, 7, 8, 5, 10, 11, 12, 9, 13, 14, 15];
        expect(tileForArrow(gapLeftEdge, "ArrowRight")).toBeNull();
        expect(tileForArrow(gapLeftEdge, "ArrowLeft")).toBe(6);
    });
});
