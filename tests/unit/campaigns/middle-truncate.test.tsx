/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { middleEllipsis, MiddleTruncate, splitTail } from "@/components/ui/middle-truncate";
afterEach(cleanup);
describe("middle truncation", () => {
    it("keeps the longest run of trailing segments (4–18 characters) as the tail", () => {
        expect(splitTail("AGY_ClientCo_Google_NB_perfect_binding")).toEqual(["AGY_ClientCo_Google_NB", "_perfect_binding"]);
        expect(splitTail("AGY_ClientCo_Google_PerfMax")).toEqual(["AGY_ClientCo", "_Google_PerfMax"]);
        expect(splitTail("AGY_ClientCo_Google_NB")).toEqual(["AGY_ClientCo", "_Google_NB"]);
        expect(splitTail("Generic — Running Shoes")).toEqual(["Generic", " — Running Shoes"]);
        expect(splitTail("Brand — Core")).toEqual(["Brand — Core", ""]);
        expect(splitTail("Supercalifragilisticexpialidocious")).toEqual(["Supercalifragilisticexpialidocious", ""]);
    });
    it("renders the head and the tail as one readable name with the full text in the title", () => {
        const { container } = render(<MiddleTruncate text="AGY_ClientCo_Google_NB_zines" className="font-medium"/>);
        const root = container.firstElementChild as HTMLElement;
        expect(root.title).toBe("AGY_ClientCo_Google_NB_zines");
        expect(root.textContent).toBe("AGY_ClientCo_Google_NB_zines");
        expect([...root.children].map((c) => c.textContent)).toEqual(["AGY_ClientCo", "_Google_NB_zines"]);
        expect(root.className).toContain("font-medium");
        const whole = render(<MiddleTruncate text="Brand"/>).container.firstElementChild as HTMLElement;
        expect(whole.children).toHaveLength(0);
        expect(whole.title).toBe("Brand");
    });
    it("keeps the space between head and tail, and lets the head shrink before the tail", () => {
        const root = render(<MiddleTruncate text="Search — Competitor Terms"/>).container.firstElementChild as HTMLElement;
        const [head, tail] = [...root.children] as HTMLElement[];
        expect([head?.textContent, tail?.textContent]).toEqual(["Search ", "— Competitor Terms"]);
        expect(head?.className).toContain("whitespace-pre");
        expect(head?.className).toContain("min-w-[2.5ch]");
        expect(tail?.className).toContain("shrink-[0.001]");
    });
    it("shortens canvas labels in the middle to a character budget", () => {
        expect(middleEllipsis("AGY_ClientCo_Google_NB_posters", 20)).toBe("AGY_Clie…_NB_posters");
        expect(middleEllipsis("Short name", 20)).toBe("Short name");
        expect(middleEllipsis("AGY_ClientCo_Google_NB_posters", 20)).toHaveLength(20);
        expect(middleEllipsis("Supercalifragilisticexpialidocious", 12)).toBe("Super…ocious");
    });
});
