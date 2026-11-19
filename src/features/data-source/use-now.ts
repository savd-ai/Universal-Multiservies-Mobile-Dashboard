"use client";

import { useSyncExternalStore } from "react";

// A shared, ticking "now" for relative times. The server snapshot is null, so relative labels only render after
// hydration (no Date.now() during render, no hydration mismatch).

let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = (): number | null => (now ||= Date.now());
const getServerSnapshot = (): number | null => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
