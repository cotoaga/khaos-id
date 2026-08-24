import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const signOut = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser, signOut },
  }),
}));

const { middleware } = await import("@/middleware");
const { mintSessionDeadline, SESSION_DEADLINE_COOKIE } = await import(
  "@/lib/session-deadline"
);

function request(pathname: string, cookies: Record<string, string> = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(new URL(pathname, "https://id.cotoaga.ai"), {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

beforeEach(() => {
  getUser.mockReset();
  signOut.mockReset();
  process.env.SESSION_DEADLINE_SECRET = "test-secret-do-not-use-in-prod";
});

describe("middleware", () => {
  it("redirects unauthenticated /account to /login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await middleware(request("/account"));
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/login?redirectTo=%2Faccount");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("passes through an authenticated request with a valid deadline cookie", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { token } = await mintSessionDeadline("1d");
    const res = await middleware(
      request("/account", { [SESSION_DEADLINE_COOKIE]: token }),
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBeNull();
  });

  it("signs out and redirects to /login?expired=1 when the deadline cookie is missing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await middleware(request("/account"));
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/login?expired=1");
  });

  it("signs out and redirects when the deadline cookie is tampered", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { token } = await mintSessionDeadline("1d");
    const res = await middleware(
      request("/account", { [SESSION_DEADLINE_COOKIE]: `${token}x` }),
    );
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/login?expired=1");
  });

  it("signs out and redirects when the deadline has passed", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const { token } = await mintSessionDeadline("1h", twoHoursAgo);
    const res = await middleware(
      request("/account", { [SESSION_DEADLINE_COOKIE]: token }),
    );
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://id.cotoaga.ai/login?expired=1");
  });

  it("does not enforce the deadline on /logout", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await middleware(request("/logout"));
    expect(signOut).not.toHaveBeenCalled();
  });
});
