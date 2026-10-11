export function hardNavigate(袟壍: string): void {
    window.location.href = new URL(袟壍, window.location.origin).href;
}
