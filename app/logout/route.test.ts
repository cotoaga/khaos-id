import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signOut },
  }),
}));

const routeModule = await import("@/app/logout/route");

beforeEach(() => {
  signOut.mockReset();
});

describe("GET /logout", () => {
  it("redirects home without touching the session (CSRF: GET has no effect)", () => {
    const res = routeModule.GET(
      new NextRequest("https://id.cotoaga.ai/logout", { method: "GET" }),
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/");
  });
});

describe("POST /logout", () => {
  it("signs out and redirects home with 303 so the follow-up is a GET", async () => {
    signOut.mockResolvedValue({ error: null });
    const res = await routeModule.POST(
      new NextRequest("https://id.cotoaga.ai/logout", { method: "POST" }),
    );
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/");
  });

  it("logs and still redirects when signOut errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    signOut.mockResolvedValue({ error: { message: "boom" } });
    const res = await routeModule.POST(
      new NextRequest("https://id.cotoaga.ai/logout", { method: "POST" }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[logout] signOut failed:",
      "boom",
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/");
    consoleError.mockRestore();
  });
});
