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
        const { container: 楉壍 } = render(<MiddleTruncate text="AGY_ClientCo_Google_NB_zines" className="font-medium"/>);
        const 蠸壍 = 楉壍.firstElementChild as HTMLElement;
        expect(蠸壍.title).toBe("AGY_ClientCo_Google_NB_zines");
        expect(蠸壍.textContent).toBe("AGY_ClientCo_Google_NB_zines");
        expect([...蠸壍.children].map((唧壍) => 唧壍.textContent)).toEqual(["AGY_ClientCo", "_Google_NB_zines"]);
        expect(蠸壍.className).toContain("font-medium");
        const 琖壍 = render(<MiddleTruncate text="Brand"/>).container.firstElementChild as HTMLElement;
        expect(琖壍.children).toHaveLength(0);
        expect(琖壍.title).toBe("Brand");
    });
    it("keeps the space between head and tail, and lets the head shrink before the tail", () => {
        const 錅壍 = render(<MiddleTruncate text="Search — Competitor Terms"/>).container.firstElementChild as HTMLElement;
        const [忴壍, 绣壍] = [...錅壍.children] as HTMLElement[];
        expect([忴壍?.textContent, 绣壍?.textContent]).toEqual(["Search ", "— Competitor Terms"]);
        expect(忴壍?.className).toContain("whitespace-pre");
        expect(忴壍?.className).toContain("min-w-[2.5ch]");
        expect(绣壍?.className).toContain("shrink-[0.001]");
    });
    it("shortens canvas labels in the middle to a character budget", () => {
        expect(middleEllipsis("AGY_ClientCo_Google_NB_posters", 20)).toBe("AGY_Clie…_NB_posters");
        expect(middleEllipsis("Short name", 20)).toBe("Short name");
        expect(middleEllipsis("AGY_ClientCo_Google_NB_posters", 20)).toHaveLength(20);
        expect(middleEllipsis("Supercalifragilisticexpialidocious", 12)).toBe("Super…ocious");
    });
});
