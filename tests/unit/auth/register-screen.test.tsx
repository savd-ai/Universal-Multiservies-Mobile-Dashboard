/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RegisterScreen } from "@/features/auth/register-screen";
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/navigation", () => ({ hardNavigate: vi.fn() }));
const bodies: unknown[] = [];
beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "That setup code is not correct.", details: { reason: "setup_code" } } }), { status: 401 });
  }));
});
afterEach(() => {
  cleanup();
  bodies.length = 0;
});
function mount(props: Parameters<typeof RegisterScreen>[0]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><RegisterScreen {...props} /></QueryClientProvider>);
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
describe("register screen", () => {
  it("asks the first account for the setup code when AUTH_SETUP_TOKEN is set and sends it", async () => {
    mount({ firstAccount: true, setupCodeRequired: true });
    fill("Setup code", "abc-123");
    fill("Your name", "Owner");
    fill("Email", "owner@example.com");
    fill("Password", "correct horse battery");
    fill("Repeat password", "correct horse battery");
    fireEvent.submit(screen.getByRole("button", { name: /Create admin/ }).closest("form")!);
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ email: "owner@example.com", setupCode: "abc-123" });
    expect(await screen.findByText("That setup code is not correct.")).toBeTruthy();
  });

  it("has no setup code field otherwise", () => {
    mount({ firstAccount: true });
    expect(screen.queryByLabelText("Setup code")).toBeNull();
    cleanup();
    mount({ firstAccount: false });
    expect(screen.queryByLabelText("Setup code")).toBeNull();
  });
});
