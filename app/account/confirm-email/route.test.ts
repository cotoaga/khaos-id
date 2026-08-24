import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const updateUserById = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById } },
  }),
}));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { GET } = await import("@/app/account/confirm-email/route");
const { mintActionToken } = await import("@/lib/action-token");

function req(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  updateUserById.mockReset();
});

describe("GET /account/confirm-email", () => {
  it("bounces with a clean message when the token is missing", async () => {
    const res = await GET(req("https://khaos-id.test/account/confirm-email"));
    expect(res.headers.get("location")).toContain("/account?error=");
  });

  it("bounces on an invalid token", async () => {
    const res = await GET(req("https://khaos-id.test/account/confirm-email?token=garbage"));
    expect(res.headers.get("location")).toContain("/account?error=");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("swaps the email and redirects to /account on success", async () => {
    const token = await mintActionToken(
      { sub: "user-1", purpose: "confirm_email_change", newEmail: "new@example.com" },
      60,
    );
    updateUserById.mockResolvedValue({ error: null });
    const res = await GET(req(`https://khaos-id.test/account/confirm-email?token=${token}`));
    expect(updateUserById).toHaveBeenCalledWith("user-1", {
      email: "new@example.com",
      email_confirm: true,
    });
    expect(res.headers.get("location")).toContain("/account?emailChanged=1");
  });

  it("bounces when the new address is already taken", async () => {
    const token = await mintActionToken(
      { sub: "user-1", purpose: "confirm_email_change", newEmail: "taken@example.com" },
      60,
    );
    updateUserById.mockResolvedValue({ error: { message: "Email address already registered" } });
    const res = await GET(req(`https://khaos-id.test/account/confirm-email?token=${token}`));
    expect(res.headers.get("location")).toContain("/account?error=");
  });
});
