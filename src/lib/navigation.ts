/** Full page load to a same-origin path: signing in or out must drop every cached query and re-run the layouts. */
export function hardNavigate(path: string): void {
  window.location.href = new URL(path, window.location.origin).href;
}
