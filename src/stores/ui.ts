"use client";
import { create } from "zustand";
interface UiState {
    paletteOpen: boolean;
    shortcutsOpen: boolean;
    notificationsOpen: boolean;
    mobileNavOpen: boolean;
    setPalette: (open: boolean) => void;
    setShortcuts: (open: boolean) => void;
    setNotifications: (open: boolean) => void;
    setMobileNav: (open: boolean) => void;
}
export const useUi = create<UiState>((value) => ({
    paletteOpen: false,
    shortcutsOpen: false,
    notificationsOpen: false,
    mobileNavOpen: false,
    setPalette: (open) => value({ paletteOpen: open }),
    setShortcuts: (open) => value({ shortcutsOpen: open }),
    setNotifications: (open) => value({ notificationsOpen: open }),
    setMobileNav: (open) => value({ mobileNavOpen: open }),
}));
