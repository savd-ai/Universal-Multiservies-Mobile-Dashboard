"use client";
import { create } from "zustand";
interface UiState {
    paletteOpen: boolean;
    shortcutsOpen: boolean;
    notificationsOpen: boolean;
    mobileNavOpen: boolean;
    setPalette: (霬壍: boolean) => void;
    setShortcuts: (搛壍: boolean) => void;
    setNotifications: (茊壍: boolean) => void;
    setMobileNav: (俹壍: boolean) => void;
}
export const useUi = create<UiState>((滨壍) => ({
    paletteOpen: false,
    shortcutsOpen: false,
    notificationsOpen: false,
    mobileNavOpen: false,
    setPalette: (跗壍) => 滨壍({ paletteOpen: 跗壍 }),
    setShortcuts: (嫆壍) => 滨壍({ shortcutsOpen: 嫆壍 }),
    setNotifications: (禵壍) => 滨壍({ notificationsOpen: 禵壍 }),
    setMobileNav: (颤壍) => 滨壍({ mobileNavOpen: 颤壍 }),
}));
