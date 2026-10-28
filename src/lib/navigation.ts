export function hardNavigate(path: string): void {
    window.location.href = new URL(path, window.location.origin).href;
}
