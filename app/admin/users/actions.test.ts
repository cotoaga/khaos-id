import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRootOr404 = vi.fn();
const getUserById = vi.fn();
const updateUserById = vi.fn();
const generateLink = vi.fn();
const sendMail = vi.fn();
const approveVisitorRequest = vi.fn();
const declineVisitorRequest = vi.fn();
const resendGuestInvite = vi.fn();
const revokeGuestInvite = vi.fn();

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

vi.mock("@/lib/root-guard", () => ({ requireRootOr404 }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById, updateUserById, generateLink } },
  }),
}));

vi.mock("@/lib/mail/resend", () => ({ sendMail }));
vi.mock("@/lib/account-review", () => ({ approveVisitorRequest, declineVisitorRequest }));
vi.mock("@/lib/guest-invite", () => ({ resendGuestInvite, revokeGuestInvite }));

const {
  upgradeToGuestAction,
  downgradeToVisitorAction,
  triggerPasswordResetAction,
  disableUserAction,
  enableUserAction,
  approvePendingAction,
  declinePendingAction,
  resendInviteFromDashboardAction,
  revokeInviteFromDashboardAction,
} = await import("@/app/admin/users/actions");

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
  requireRootOr404.mockReset().mockResolvedValue({ userId: "root-1", email: "kurt@cotoaga.net" });
  getUserById.mockReset();
  updateUserById.mockReset();
  generateLink.mockReset();
  sendMail.mockReset();
  approveVisitorRequest.mockReset();
  declineVisitorRequest.mockReset();
  resendGuestInvite.mockReset();
  revokeGuestInvite.mockReset();
});

describe("upgradeToGuestAction", () => {
  it("upgrades a visitor to guest", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "vis@example.com", app_metadata: { tier: "visitor" } } },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    const target = await captureRedirect(upgradeToGuestAction(fd({ userId: "u1" })));
    expect(requireRootOr404).toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith("u1", { app_metadata: { tier: "guest" } });
    expect(target).toBe("/admin/users?upgraded=1");
  });

  it("refuses to touch root", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "root-1", email: "kurt@cotoaga.net", app_metadata: { tier: "root" } } },
      error: null,
    });
    const target = await captureRedirect(upgradeToGuestAction(fd({ userId: "root-1" })));
    expect(target).toMatch(/^\/admin\/users\?error=/);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a non-visitor", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "g@example.com", app_metadata: { tier: "guest" } } },
      error: null,
    });
    const target = await captureRedirect(upgradeToGuestAction(fd({ userId: "u1" })));
    expect(target).toMatch(/^\/admin\/users\?error=/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("downgradeToVisitorAction", () => {
  it("downgrades a guest to visitor", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "g@example.com", app_metadata: { tier: "guest" } } },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    const target = await captureRedirect(downgradeToVisitorAction(fd({ userId: "u1" })));
    expect(updateUserById).toHaveBeenCalledWith("u1", { app_metadata: { tier: "visitor" } });
    expect(target).toBe("/admin/users?downgraded=1");
  });

  it("refuses a non-guest", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "v@example.com", app_metadata: { tier: "visitor" } } },
      error: null,
    });
    const target = await captureRedirect(downgradeToVisitorAction(fd({ userId: "u1" })));
    expect(target).toMatch(/^\/admin\/users\?error=/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("triggerPasswordResetAction", () => {
  it("generates a recovery link and mails it via Resend", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "g@example.com" } },
      error: null,
    });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-abc" } },
      error: null,
    });
    const target = await captureRedirect(triggerPasswordResetAction(fd({ userId: "u1" })));
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: "g@example.com" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "g@example.com",
        html: expect.stringContaining("hashed-abc"),
      }),
    );
    expect(target).toBe("/admin/users?resetsent=1");
  });
});

describe("disableUserAction", () => {
  it("bans the user for ~100 years", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "g@example.com" } },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    const target = await captureRedirect(disableUserAction(fd({ userId: "u1" })));
    expect(updateUserById).toHaveBeenCalledWith("u1", { ban_duration: "876000h" });
    expect(target).toBe("/admin/users?disabled=1");
  });

  it("refuses to disable root", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "root-1", email: "kurt@cotoaga.net" } },
      error: null,
    });
    const target = await captureRedirect(disableUserAction(fd({ userId: "root-1" })));
    expect(target).toMatch(/^\/admin\/users\?error=/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("enableUserAction", () => {
  it("lifts the ban", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "g@example.com" } },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    const target = await captureRedirect(enableUserAction(fd({ userId: "u1" })));
    expect(updateUserById).toHaveBeenCalledWith("u1", { ban_duration: "none" });
    expect(target).toBe("/admin/users?enabled=1");
  });

  it("is idempotent on an already-active account", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u1", email: "g@example.com", banned_until: null } },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    const target = await captureRedirect(enableUserAction(fd({ userId: "u1" })));
    expect(updateUserById).toHaveBeenCalledWith("u1", { ban_duration: "none" });
    expect(target).toBe("/admin/users?enabled=1");
  });

  it("blocks non-root callers", async () => {
    requireRootOr404.mockRejectedValueOnce(new Error("NEXT_NOT_FOUND"));
    await expect(enableUserAction(fd({ userId: "u1" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("approvePendingAction / declinePendingAction", () => {
  it("approves and redirects", async () => {
    approveVisitorRequest.mockResolvedValue({ outcome: "approved" });
    const target = await captureRedirect(approvePendingAction(fd({ userId: "u1" })));
    expect(approveVisitorRequest).toHaveBeenCalledWith("u1", "https://khaos-id.test");
    expect(target).toBe("/admin/users?approved=1");
  });

  it("bounces when the request was already handled", async () => {
    approveVisitorRequest.mockResolvedValue({ outcome: "already_handled" });
    const target = await captureRedirect(approvePendingAction(fd({ userId: "u1" })));
    expect(target).toMatch(/^\/admin\/users\?error=/);
  });

  it("declines and redirects", async () => {
    declineVisitorRequest.mockResolvedValue({ outcome: "declined" });
    const target = await captureRedirect(declinePendingAction(fd({ userId: "u1" })));
    expect(target).toBe("/admin/users?declined=1");
  });
});

describe("resendInviteFromDashboardAction / revokeInviteFromDashboardAction", () => {
  it("resends and redirects", async () => {
    resendGuestInvite.mockResolvedValue({ outcome: "ok" });
    const target = await captureRedirect(resendInviteFromDashboardAction(fd({ userId: "u1" })));
    expect(resendGuestInvite).toHaveBeenCalledWith("u1", "https://khaos-id.test");
    expect(target).toBe("/admin/users?resent=1");
  });

  it("revokes and redirects", async () => {
    revokeGuestInvite.mockResolvedValue({ outcome: "ok" });
    const target = await captureRedirect(revokeInviteFromDashboardAction(fd({ userId: "u1" })));
    expect(revokeGuestInvite).toHaveBeenCalledWith("u1");
    expect(target).toBe("/admin/users?revoked=1");
  });

  it("bounces when the invite is no longer pending", async () => {
    resendGuestInvite.mockResolvedValue({ outcome: "not_pending" });
    const target = await captureRedirect(resendInviteFromDashboardAction(fd({ userId: "u1" })));
    expect(target).toMatch(/^\/admin\/users\?error=/);
  });
});
