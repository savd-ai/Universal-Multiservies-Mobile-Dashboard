"use client";

import { create } from "zustand";

// Transient UI state shared across the shell (overlays, chat, palette). Per-viewer prefs use localStorage.

interface UiState {
  chatOpen: boolean;
  chatSeed: string | null;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  notificationsOpen: boolean;
  mobileNavOpen: boolean;
  openChat: (seed?: string) => void;
  closeChat: () => void;
  setPalette: (open: boolean) => void;
  setShortcuts: (open: boolean) => void;
  setNotifications: (open: boolean) => void;
  setMobileNav: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  chatOpen: false,
  chatSeed: null,
  paletteOpen: false,
  shortcutsOpen: false,
  notificationsOpen: false,
  mobileNavOpen: false,
  openChat: (seed) => set({ chatOpen: true, chatSeed: seed ?? null, paletteOpen: false }),
  closeChat: () => set({ chatOpen: false, chatSeed: null }),
  setPalette: (open) => set({ paletteOpen: open }),
  setShortcuts: (open) => set({ shortcutsOpen: open }),
  setNotifications: (open) => set({ notificationsOpen: open }),
  setMobileNav: (open) => set({ mobileNavOpen: open }),
}));
