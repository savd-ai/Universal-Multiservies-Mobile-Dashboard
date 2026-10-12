"use client";
import { useEffect, useRef } from "react";

/**
 * While the human check is on screen, anyone who opens Chrome DevTools or edits the overlay away is signed
 * out and sent to /login. This is a deterrent, not the lock: the server renders no page content and every
 * data route answers 403 `captcha_required` until the session has solved the puzzle (src/lib/server/captcha).
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

/** True when the overlay is gone, hidden, see-through, click-through or covered. */
export function overlayCompromised(root: HTMLElement | null): boolean {
  if (!root || !root.isConnected) return true;
  if (root.hidden || root.hasAttribute("inert")) return true;
  const style = window.getComputedStyle(root);
  if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) < 0.95 || style.position !== "fixed" || style.pointerEvents === "none") return true;
  for (let el: HTMLElement | null = root.parentElement; el; el = el.parentElement) {
    const s = window.getComputedStyle(el);
    if (s.display === "none" || Number(s.opacity) < 0.95) return true;
  }
  const rect = root.getBoundingClientRect();
  if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) return true;
  if (typeof document.elementFromPoint === "function" && window.innerWidth > 0 && window.innerHeight > 0) {
    for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7]] as const) {
      const hit = document.elementFromPoint(window.innerWidth * fx, window.innerHeight * fy);
      if (!hit) continue;
      if (process.env.NODE_ENV !== "production" && hit.tagName === "NEXTJS-PORTAL") continue; // Next's dev overlay
      if (!root.contains(hit)) return true;
    }
  }
  return false;
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

export function useTamperGuard(rootRef: React.RefObject<HTMLElement | null>, enabled: boolean): void {
  const tripped = useRef(false);
  useEffect(() => {
    if (!enabled) return;
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
      if (overlayCompromised(rootRef.current)) trip("tamper");
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden", "inert"] });
    const onKey = (event: KeyboardEvent) => {
      if (isDevtoolsShortcut(event)) {
        event.preventDefault();
        trip("devtools");
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault(); // no "Inspect" from the menu
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onContextMenu, true);
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
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [enabled, rootRef]);
}
