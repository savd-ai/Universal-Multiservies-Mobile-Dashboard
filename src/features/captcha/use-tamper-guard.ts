"use client";
import { useEffect, useRef } from "react";

/**
 * While the human check is on screen, anyone who opens Chrome DevTools or edits the overlay away is signed
 * out and sent to /login. This is a deterrent, not the lock: the server renders no page content and every
 * data route answers 403 `captcha_required` until the session has solved the puzzle (src/lib/server/captcha).
 * Nothing in the browser can make removal impossible (the person owns the browser); the guard makes it pointless
 * (the page underneath is empty) and costly (the session ends). See .agents/bao-mat-captcha for the threat model.
 */

export type TripReason = "devtools" | "tamper";

export const TRIP_MESSAGES: Record<TripReason, string> = {
  devtools: "You were signed out because developer tools were opened while the human check was on screen.",
  tamper: "You were signed out because the human check was changed or hidden.",
};

/** F12, Cmd+Opt+I/J/C (macOS) and Ctrl+Shift+I/J/C (elsewhere) open DevTools in Chrome. */
export function isDevtoolsShortcut(event: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): boolean {
  if (event.key === "F12" || event.code === "F12") return true;
  const letter = (event.code?.startsWith("Key") ? event.code.slice(3) : event.key ?? "").toUpperCase();
  if (!["I", "J", "C"].includes(letter)) return false;
  return (event.metaKey && event.altKey) || (event.ctrlKey && event.shiftKey);
}

export interface WindowFrame {
  outerWidth: number;
  innerWidth: number;
  outerHeight: number;
  innerHeight: number;
  dpr: number;
}

/** A docked DevTools panel eats at least this many pixels of the window beyond what the browser chrome took at start. */
export const DOCKED_THRESHOLD = 160;

export function dockedDevtools(baseline: WindowFrame, current: WindowFrame): boolean {
  if (Math.abs(current.dpr - baseline.dpr) > 0.001) return false; // zoom changed; caller re-baselines
  const grewW = current.outerWidth - current.innerWidth - (baseline.outerWidth - baseline.innerWidth);
  const grewH = current.outerHeight - current.innerHeight - (baseline.outerHeight - baseline.innerHeight);
  return grewW > DOCKED_THRESHOLD || grewH > DOCKED_THRESHOLD;
}

function frame(): WindowFrame {
  return { outerWidth: window.outerWidth, innerWidth: window.innerWidth, outerHeight: window.outerHeight, innerHeight: window.innerHeight, dpr: window.devicePixelRatio || 1 };
}

/**
 * The overlay's own layout, pinned as inline `!important` declarations so author CSS (a userscript's `<style>`,
 * a stylesheet added in DevTools) cannot override it. Extensions that inject user-origin CSS (ad-block cosmetic
 * filters) still win the cascade, which is why every check below reads the computed style, not the declarations.
 */
export const PINNED_STYLE: ReadonlyArray<readonly [string, string]> = [
  ["display", "block"],
  ["position", "fixed"],
  ["inset", "0px"],
  ["z-index", "2147483000"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["pointer-events", "auto"],
  ["transform", "none"],
  ["filter", "none"],
  ["clip-path", "none"],
  ["content-visibility", "visible"],
];

/** The puzzle card inside the overlay: hiding only the card would leave an empty curtain nobody can get past. */
export const CARD_SELECTOR = "[role=dialog]";

export const PINNED_CARD_STYLE: ReadonlyArray<readonly [string, string]> = [
  ["display", "flex"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["filter", "none"],
  ["clip-path", "none"],
  ["content-visibility", "visible"],
];

function pin(el: HTMLElement, declarations: ReadonlyArray<readonly [string, string]>): void {
  for (const [prop, value] of declarations) {
    if (el.style.getPropertyValue(prop) !== value || el.style.getPropertyPriority(prop) !== "important") el.style.setProperty(prop, value, "important");
  }
}

export function pinOverlayStyle(root: HTMLElement): void {
  pin(root, PINNED_STYLE);
  const card = root.querySelector<HTMLElement>(CARD_SELECTOR);
  if (card) pin(card, PINNED_CARD_STYLE);
}

/** The computed properties the checks read; jsdom and old engines return "" for some, which counts as unset. */
export type StyleSnapshot = Pick<
  CSSStyleDeclaration,
  "display" | "visibility" | "opacity" | "position" | "pointerEvents" | "clipPath" | "filter" | "maskImage" | "contentVisibility"
> & { webkitMaskImage?: string };

const unset = (value: string | undefined) => !value || value === "none" || value === "auto" || value === "visible" || value === "initial";

function amount(raw: string): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 1;
  return raw.trim().endsWith("%") ? value / 100 : value;
}

/** True when a CSS `filter` makes an element (and so the whole overlay) see-through or black. Colour filters such as Dark Reader's `invert()` are fine. */
export function filterHides(filter: string | undefined): boolean {
  if (unset(filter)) return false;
  for (const match of (filter ?? "").matchAll(/(opacity|brightness|contrast)\(\s*([^)]*)\)/g)) {
    const value = amount(match[2] || "1");
    if (match[1] === "opacity" && value < 0.95) return true;
    if (match[1] !== "opacity" && value < 0.3) return true;
  }
  return /blur\(\s*([4-9]|\d{2,})/.test(filter ?? "");
}

/** Properties that hide an element or everything inside it, wherever they are set (the overlay or any ancestor). */
function hidesSubtree(s: StyleSnapshot): boolean {
  if (s.display === "none" || s.display === "contents") return true;
  if (s.opacity !== "" && Number(s.opacity) < 0.95) return true;
  if (s.contentVisibility === "hidden") return true;
  if (!unset(s.clipPath)) return true;
  if (!unset(s.maskImage) || !unset(s.webkitMaskImage)) return true;
  return filterHides(s.filter);
}

/** True when the overlay's own computed style hides it, lets clicks through or takes it out of the fixed layer. */
export function rootStyleHides(s: StyleSnapshot): boolean {
  return hidesSubtree(s) || s.visibility !== "visible" || s.position !== "fixed" || s.pointerEvents === "none";
}

/** True when an ancestor (body, html, a wrapper) hides everything inside it. */
export function ancestorStyleHides(s: StyleSnapshot): boolean {
  return hidesSubtree(s);
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Share of the viewport the box covers (0–1), after transforms, so `scale(0)`, off-screen moves and resizes all show. */
export function viewportCoverage(box: Box, width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const w = Math.max(0, Math.min(box.left + box.width, width) - Math.max(box.left, 0));
  const h = Math.max(0, Math.min(box.top + box.height, height) - Math.max(box.top, 0));
  return (w * h) / (width * height);
}

/** Where the overlay must be the topmost element: the centre and four points well inside the corners. */
export const PROBE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
];

/** True when the overlay is gone, hidden, see-through, clipped, shrunk, moved, click-through or covered. */
export function overlayCompromised(root: HTMLElement | null): boolean {
  if (!root || !root.isConnected) return true;
  if (root.hidden || root.hasAttribute("inert") || root.hasAttribute("popover")) return true;
  if (rootStyleHides(window.getComputedStyle(root))) return true;
  for (let el: HTMLElement | null = root.parentElement; el; el = el.parentElement) {
    if (el.hidden || el.hasAttribute("inert")) return true;
    if (ancestorStyleHides(window.getComputedStyle(el))) return true;
  }
  const rect = root.getBoundingClientRect();
  if (viewportCoverage(rect, window.innerWidth, window.innerHeight) < 0.9) return true;
  const probe = typeof document.elementFromPoint === "function" && window.innerWidth > 0 && window.innerHeight > 0;
  if (probe) {
    for (const [fx, fy] of PROBE_POINTS) {
      if (!topmostInside(root, window.innerWidth * fx, window.innerHeight * fy)) return true;
    }
  }
  return cardCompromised(root, probe);
}

function topmostInside(container: HTMLElement, x: number, y: number): boolean {
  const hit = document.elementFromPoint(x, y);
  if (!hit) return true;
  if (process.env.NODE_ENV !== "production" && hit.tagName === "NEXTJS-PORTAL") return true; // Next's dev overlay
  return container.contains(hit);
}

/** True when the puzzle card is missing, hidden, collapsed or covered inside an otherwise intact overlay. */
function cardCompromised(root: HTMLElement, probe: boolean): boolean {
  const card = root.querySelector<HTMLElement>(CARD_SELECTOR);
  if (!card) return true;
  for (let el: HTMLElement | null = card; el && el !== root; el = el.parentElement) {
    if (el.hidden || el.hasAttribute("inert")) return true;
    if (ancestorStyleHides(window.getComputedStyle(el))) return true;
  }
  if (window.getComputedStyle(card).visibility !== "visible") return true;
  const box = card.getBoundingClientRect();
  if (box.width < 120 || box.height < 120) return true;
  return probe && !topmostInside(card, box.left + box.width / 2, box.top + Math.min(box.height / 2, 60));
}

export function signOutAndRedirect(reason: TripReason): void {
  const target = `/login?error=${encodeURIComponent(TRIP_MESSAGES[reason])}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    window.location.replace(target);
  };
  try {
    window.sessionStorage.removeItem(CAPTCHA_PROGRESS_KEY);
  } catch {
    /* storage may be blocked */
  }
  void fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin", keepalive: true })
    .catch(() => undefined)
    .finally(go);
  window.setTimeout(go, 1500);
}

export const CAPTCHA_PROGRESS_KEY = "savd-captcha-progress";

/** How often the overlay is re-measured. Extension CSS (ad-block cosmetic filters) adds no DOM node, so only polling sees it. */
export const WATCH_MS = 250;

export function useTamperGuard(rootRef: React.RefObject<HTMLElement | null>, enabled: boolean): void {
  const tripped = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    // Hold the node itself: removing it, or swapping in a look-alike copy, leaves this reference disconnected.
    const node = rootRef.current;
    const trip = (reason: TripReason) => {
      if (tripped.current) return;
      tripped.current = true;
      signOutAndRedirect(reason);
    };
    let baseline = frame();
    // Built at runtime because minifiers drop literal `debugger` statements from production bundles.
    let trap: () => void = () => undefined;
    try {
      trap = new Function("debugger") as () => void;
    } catch {
      /* a CSP without 'unsafe-eval' blocks this; the other checks still run */
    }
    const inspect = () => {
      if (tripped.current) return;
      if (node && node.isConnected) pinOverlayStyle(node);
      if (node !== rootRef.current || overlayCompromised(node)) trip("tamper");
    };
    // 1. Every DOM change: removed nodes, new <style>/<link> sheets, edited style/class/hidden/inert attributes.
    const observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "inert", "id", "popover", "open", "media", "disabled"],
    });
    // 2. A frame loop, throttled: catches CSS that arrives without a DOM change (extension-injected sheets, adoptedStyleSheets).
    let frameId = 0;
    let lastFrameCheck = 0;
    const loop = (at: number) => {
      if (at - lastFrameCheck >= WATCH_MS) {
        lastFrameCheck = at;
        inspect();
      }
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);
    // 3. A timer that also runs when frames are throttled, plus the DevTools checks.
    const fast = window.setInterval(inspect, WATCH_MS);
    const onKey = (event: KeyboardEvent) => {
      if (isDevtoolsShortcut(event)) {
        event.preventDefault();
        trip("devtools");
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault(); // no "Inspect" from the menu
    const onVisible = () => {
      if (document.visibilityState === "visible") inspect();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("resize", inspect);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      inspect();
      const now = frame();
      if (Math.abs(now.dpr - baseline.dpr) > 0.001) baseline = now;
      else if (dockedDevtools(baseline, now)) trip("devtools");
      // A `debugger` statement only pauses when DevTools is open (docked or undocked); the pause is the signal.
      const started = performance.now();
      trap(); // intentional DevTools trap, see above
      if (performance.now() - started > 200) trip("devtools");
    }, 1000);
    inspect();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
      window.clearInterval(fast);
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("resize", inspect);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, rootRef]);
}
