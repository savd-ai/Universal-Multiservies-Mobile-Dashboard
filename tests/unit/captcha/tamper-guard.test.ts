import { describe, expect, it } from "vitest";
import { dockedDevtools, isDevtoolsShortcut, type WindowFrame } from "@/features/captcha/use-tamper-guard";

const key = (over: Partial<KeyboardEvent>) => ({ key: "", code: "", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...over }) as KeyboardEvent;

describe("tamper guard", () => {
  it("recognises the Chrome DevTools shortcuts", () => {
    expect(isDevtoolsShortcut(key({ key: "F12", code: "F12" }))).toBe(true);
    expect(isDevtoolsShortcut(key({ key: "ˆ", code: "KeyI", metaKey: true, altKey: true }))).toBe(true);
    expect(isDevtoolsShortcut(key({ key: "J", code: "KeyJ", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isDevtoolsShortcut(key({ key: "C", code: "KeyC", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isDevtoolsShortcut(key({ key: "c", code: "KeyC", ctrlKey: true }))).toBe(false); // copy
    expect(isDevtoolsShortcut(key({ key: "i", code: "KeyI", metaKey: true }))).toBe(false);
    expect(isDevtoolsShortcut(key({ key: "ArrowUp", code: "ArrowUp" }))).toBe(false);
  });

  it("notices a docked panel relative to the starting frame, not the browser chrome", () => {
    const base: WindowFrame = { outerWidth: 1440, innerWidth: 1440, outerHeight: 900, innerHeight: 812, dpr: 2 };
    expect(dockedDevtools(base, base)).toBe(false);
    expect(dockedDevtools(base, { ...base, innerWidth: 1000 })).toBe(true);
    expect(dockedDevtools(base, { ...base, innerHeight: 500 })).toBe(true);
    expect(dockedDevtools(base, { ...base, innerWidth: 1340 })).toBe(false);
    expect(dockedDevtools(base, { ...base, innerWidth: 1000, dpr: 2.5 })).toBe(false); // zoom: re-baseline instead
  });
});
