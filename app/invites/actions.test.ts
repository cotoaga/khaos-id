import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRootSession = vi.fn();
const createUser = vi.fn();
const getUserById = vi.fn();
const updateUserById = vi.fn();
const deleteUser = vi.fn();
const sendMail = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`__REDIRECT__:${target}`);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-proto", "https"],
      ["host", "khaos-id.test"],
    ]),
}));

vi.mock("@/lib/root-guard", () => ({ requireRootSession }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser, getUserById, updateUserById, deleteUser } },
  }),
}));

vi.mock("@/lib/mail/resend", () => ({ sendMail }));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { inviteGuestAction, resendInviteAction, revokeInviteAction } =
  await import("@/app/invites/actions");

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

async function captureRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("__REDIRECT__:")) {
      return e.message.slice("__REDIRECT__:".length);
    }
    throw e;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  requireRootSession.mockReset().mockResolvedValue({ userId: "root-1", email: "kurt@cotoaga.net" });
  createUser.mockReset();
  getUserById.mockReset();
  updateUserById.mockReset();
  deleteUser.mockReset();
  sendMail.mockReset();
});

describe("inviteGuestAction", () => {
  it("creates a pending-invite user from just an email and sends the invite mail", async () => {
    createUser.mockResolvedValue({ data: { user: { id: "guest-1" } }, error: null });
    const target = await captureRedirect(
      inviteGuestAction(fd({ email: "guest@example.com" })),
    );
    expect(requireRootSession).toHaveBeenCalled();
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "guest@example.com",
        app_metadata: expect.objectContaining({ source: "invited", status: "pending_invite" }),
      }),
    );
    expect(createUser.mock.calls[0][0]).not.toHaveProperty("user_metadata");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" }),
    );
    expect(target).toBe("/invites?invited=1");
  });

  it("rejects a missing email before touching Supabase", async () => {
    const target = await captureRedirect(inviteGuestAction(fd({})));
    expect(target).toMatch(/^\/invites\?error=/);
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe("resendInviteAction", () => {
  it("refreshes invited_at and re-sends mail for a still-pending invite", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "guest-1",
          email: "guest@example.com",
          app_metadata: { source: "invited", status: "pending_invite", invited_at: "old" },
        },
      },
      error: null,
    });
    const target = await captureRedirect(resendInviteAction(fd({ userId: "guest-1" })));
    expect(updateUserById).toHaveBeenCalledWith(
      "guest-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ status: "pending_invite" }),
      }),
    );
    expect(sendMail).toHaveBeenCalled();
    expect(target).toBe("/invites?resent=1");
  });

  it("refuses to resend for a non-pending user", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "guest-1", app_metadata: { status: "active" } } },
      error: null,
    });
    const target = await captureRedirect(resendInviteAction(fd({ userId: "guest-1" })));
    expect(target).toMatch(/^\/invites\?error=/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("revokeInviteAction", () => {
  it("hard-deletes a still-pending invite", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "guest-1", app_metadata: { status: "pending_invite" } } },
      error: null,
    });
    const target = await captureRedirect(revokeInviteAction(fd({ userId: "guest-1" })));
    expect(deleteUser).toHaveBeenCalledWith("guest-1");
    expect(target).toBe("/invites?revoked=1");
  });

  it("refuses to revoke a non-pending user", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "guest-1", app_metadata: { status: "active" } } },
      error: null,
    });
    const target = await captureRedirect(revokeInviteAction(fd({ userId: "guest-1" })));
    expect(target).toMatch(/^\/invites\?error=/);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
