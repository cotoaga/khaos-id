import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const verifyAccessToken = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`__REDIRECT__:${target}`);
  },
  notFound: () => {
    throw new Error("__NOT_FOUND__");
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getSession },
  }),
}));

vi.mock("@/lib/jwt", () => ({ verifyAccessToken }));

const { requireRootOr404 } = await import("@/lib/root-guard");

beforeEach(() => {
  getSession.mockReset();
  verifyAccessToken.mockReset();
});

describe("requireRootOr404", () => {
  it("404s when there is no session — same as any unknown route", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(requireRootOr404()).rejects.toThrow("__NOT_FOUND__");
  });

  it("404s when the access token fails JWKS verification", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "bad", user: { id: "u1" } } },
    });
    verifyAccessToken.mockRejectedValue(new Error("bad signature"));
    await expect(requireRootOr404()).rejects.toThrow("__NOT_FOUND__");
  });

  it("404s a non-root tier — no redirect, no hint the route exists", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok", user: { id: "u1" } } },
    });
    verifyAccessToken.mockResolvedValue({ payload: { tier: "guest" }, protectedHeader: {} });
    await expect(requireRootOr404()).rejects.toThrow("__NOT_FOUND__");
  });

  it("returns the session for tier=root", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok",
          user: { id: "root-1", email: "kurt@cotoaga.ai" },
        },
      },
    });
    verifyAccessToken.mockResolvedValue({ payload: { tier: "root" }, protectedHeader: {} });
    const result = await requireRootOr404();
    expect(result).toEqual({ userId: "root-1", email: "kurt@cotoaga.ai" });
  });
});
