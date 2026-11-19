// Shared Vitest setup. DOM matchers are only needed by the jsdom UI tests.
export {};

if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
}
