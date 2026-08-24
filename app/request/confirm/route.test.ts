import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserById = vi.fn();
const updateUserById = vi.fn();
const sendMail = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById, updateUserById } },
  }),
}));

vi.mock("@/lib/mail/resend", () => ({ sendMail }));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { GET } = await import("@/app/request/confirm/route");
const { mintActionToken } = await import("@/lib/action-token");

beforeEach(() => {
  getUserById.mockReset();
  updateUserById.mockReset();
  sendMail.mockReset();
});

function req(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /request/confirm", () => {
  it("bounces with a clean message when the token is missing", async () => {
    const res = await GET(req("https://khaos-id.test/request/confirm"));
    expect(res.headers.get("location")).toContain("/request?error=");
  });

  it("bounces with a clean message on an invalid token", async () => {
    const res = await GET(
      req("https://khaos-id.test/request/confirm?token=garbage"),
    );
    expect(res.headers.get("location")).toContain("/request?error=");
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("bounces when the pending user is gone or already confirmed", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "confirm_request" }, 60);
    getUserById.mockResolvedValue({
      data: { user: { app_metadata: { status: "pending_review" } } },
      error: null,
    });
    const res = await GET(
      req(`https://khaos-id.test/request/confirm?token=${token}`),
    );
    expect(res.headers.get("location")).toContain("/request?error=");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("flips status to pending_review and notifies root on success", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "confirm_request" }, 60);
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "vis@example.com",
          user_metadata: { name: "Ada", surname: "Lovelace" },
          app_metadata: { status: "pending_confirmation" },
        },
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });

    const res = await GET(
      req(`https://khaos-id.test/request/confirm?token=${token}`),
    );

    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ status: "pending_review" }),
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "kurt@cotoaga.net" }),
    );
    expect(res.headers.get("location")).toContain("/request?confirmed=1");
  });
});
