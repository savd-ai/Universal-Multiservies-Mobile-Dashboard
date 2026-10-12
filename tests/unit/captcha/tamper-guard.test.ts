// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  ancestorStyleHides,
  dockedDevtools,
  filterHides,
  isDevtoolsShortcut,
  overlayCompromised,
  pinOverlayStyle,
  rootStyleHides,
  viewportCoverage,
  type StyleSnapshot,
  type WindowFrame,
} from "@/features/captcha/use-tamper-guard";

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

  it("reads filters that make the overlay see-through or black, but not colour filters", () => {
    expect(filterHides("none")).toBe(false);
    expect(filterHides("")).toBe(false);
    expect(filterHides("invert(0.93) hue-rotate(180deg)")).toBe(false); // Dark Reader
    expect(filterHides("opacity(0)")).toBe(true);
    expect(filterHides("opacity(50%)")).toBe(true);
    expect(filterHides("opacity(1)")).toBe(false);
    expect(filterHides("brightness(0)")).toBe(true);
    expect(filterHides("contrast(0.1)")).toBe(true);
    expect(filterHides("blur(20px)")).toBe(true);
    expect(filterHides("blur(1px)")).toBe(false);
  });

  it("flags every computed style an ad blocker or a stylesheet can use to hide the overlay", () => {
    const ok: StyleSnapshot = {
      display: "block",
      visibility: "visible",
      opacity: "1",
      position: "fixed",
      pointerEvents: "auto",
      clipPath: "none",
      filter: "none",
      maskImage: "none",
      contentVisibility: "visible",
    };
    expect(rootStyleHides(ok)).toBe(false);
    expect(ancestorStyleHides({ ...ok, position: "static" })).toBe(false);
    for (const change of [
      { display: "none" },
      { display: "contents" },
      { visibility: "hidden" },
      { visibility: "collapse" },
      { opacity: "0" },
      { opacity: "0.9" },
      { position: "absolute" },
      { pointerEvents: "none" },
      { clipPath: "inset(50%)" },
      { clipPath: "circle(0px)" },
      { maskImage: "linear-gradient(transparent, transparent)" },
      { webkitMaskImage: "url(x.png)" },
      { contentVisibility: "hidden" },
      { filter: "opacity(0)" },
    ] satisfies Partial<StyleSnapshot>[]) {
      expect(rootStyleHides({ ...ok, ...change }), JSON.stringify(change)).toBe(true);
    }
    for (const change of [{ display: "none" }, { opacity: "0" }, { clipPath: "inset(0 0 100% 0)" }, { contentVisibility: "hidden" }, { filter: "brightness(0)" }]) {
      expect(ancestorStyleHides({ ...ok, ...change }), JSON.stringify(change)).toBe(true);
    }
  });

  it("measures how much of the viewport the overlay still covers after transforms", () => {
    expect(viewportCoverage({ left: 0, top: 0, width: 1440, height: 900 }, 1440, 900)).toBe(1);
    expect(viewportCoverage({ left: 720, top: 450, width: 0, height: 0 }, 1440, 900)).toBe(0); // scale(0)
    expect(viewportCoverage({ left: -1440, top: 0, width: 1440, height: 900 }, 1440, 900)).toBe(0); // moved off-screen
    expect(viewportCoverage({ left: 0, top: 0, width: 720, height: 900 }, 1440, 900)).toBe(0.5);
    expect(viewportCoverage({ left: -10, top: -10, width: 2000, height: 2000 }, 1440, 900)).toBe(1);
  });
});

describe("overlayCompromised (jsdom)", () => {
  afterEach(() => document.body.replaceChildren());

  const box = (width: number, height: number) => () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });

  function mount(): HTMLDivElement {
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.getBoundingClientRect = box(window.innerWidth, window.innerHeight);
    const card = document.createElement("div");
    card.setAttribute("role", "dialog");
    card.getBoundingClientRect = box(600, 400);
    root.append(card);
    document.body.append(root);
    return root;
  }

  it("accepts the intact overlay and pins its layout as !important", () => {
    const root = mount();
    pinOverlayStyle(root);
    expect(root.style.getPropertyPriority("position")).toBe("important");
    expect(root.style.getPropertyValue("z-index")).toBe("2147483000");
    expect(overlayCompromised(root)).toBe(false);
  });

  it("notices removal, hiding attributes and hiding styles", () => {
    expect(overlayCompromised(null)).toBe(true);
    const removed = mount();
    removed.remove();
    expect(overlayCompromised(removed)).toBe(true);

    const hidden = mount();
    hidden.hidden = true;
    expect(overlayCompromised(hidden)).toBe(true);

    const inert = mount();
    inert.setAttribute("inert", "");
    expect(overlayCompromised(inert)).toBe(true);

    const styled = mount();
    styled.style.display = "none";
    expect(overlayCompromised(styled)).toBe(true);

    const fromSheet = mount();
    fromSheet.className = "blocked-by-filter";
    const sheet = document.createElement("style");
    sheet.textContent = ".blocked-by-filter { visibility: hidden !important; }"; // what a cosmetic filter injects
    document.head.append(sheet);
    expect(overlayCompromised(fromSheet)).toBe(true);
    sheet.remove();
  });

  it("notices a hidden ancestor and a shrunken overlay", () => {
    const root = mount();
    document.body.style.opacity = "0";
    expect(overlayCompromised(root)).toBe(true);
    document.body.style.opacity = "";
    root.getBoundingClientRect = box(10, 10);
    expect(overlayCompromised(root)).toBe(true);
  });

  it("notices when only the puzzle card is removed, hidden or collapsed", () => {
    const removed = mount();
    removed.querySelector("[role=dialog]")?.remove();
    expect(overlayCompromised(removed)).toBe(true);

    const hidden = mount();
    (hidden.querySelector("[role=dialog]") as HTMLElement).style.visibility = "hidden";
    expect(overlayCompromised(hidden)).toBe(true);

    const collapsed = mount();
    (collapsed.querySelector("[role=dialog]") as HTMLElement).getBoundingClientRect = box(0, 0);
    expect(overlayCompromised(collapsed)).toBe(true);

    const pinned = mount();
    const card = pinned.querySelector("[role=dialog]") as HTMLElement;
    pinOverlayStyle(pinned);
    const sheet = document.createElement("style");
    sheet.textContent = "[role=dialog] { display: none !important; }"; // author CSS loses to the inline !important pin
    document.head.append(sheet);
    expect(window.getComputedStyle(card).display).toBe("flex");
    expect(overlayCompromised(pinned)).toBe(false);
    sheet.remove();
  });
});

