import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRootSession = vi.fn();
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
    auth: { admin: { getUserById, updateUserById, deleteUser } },
  }),
}));

vi.mock("@/lib/mail/resend", () => ({ sendMail }));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { approveRequestAction, declineRequestAction } = await import("@/app/review/actions");
const { mintActionToken } = await import("@/lib/action-token");

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
  getUserById.mockReset();
  updateUserById.mockReset();
  deleteUser.mockReset();
  sendMail.mockReset();
});

describe("approveRequestAction", () => {
  it("grants tier=visitor, sends activation mail, and redirects to done=approved", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "review_request" }, 60);
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "visitor@example.com",
          app_metadata: { source: "requested", status: "pending_review" },
        },
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });

    const target = await captureRedirect(approveRequestAction(fd({ token })));

    expect(requireRootSession).toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ tier: "visitor", status: "pending_activation" }),
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "visitor@example.com" }),
    );
    expect(target).toBe("/review?done=approved");
  });

  it("redirects to alreadyhandled when the request is no longer pending", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "review_request" }, 60);
    getUserById.mockResolvedValue({
      data: { user: { app_metadata: { status: "pending_activation" } } },
      error: null,
    });
    const target = await captureRedirect(approveRequestAction(fd({ token })));
    expect(target).toBe("/review?done=alreadyhandled");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("rejects an invalid token with a clean message", async () => {
    const target = await captureRedirect(approveRequestAction(fd({ token: "garbage" })));
    expect(target).toMatch(/^\/review\?token=garbage&error=/);
    expect(getUserById).not.toHaveBeenCalled();
  });
});

describe("declineRequestAction", () => {
  it("hard-deletes the pending user — no corpse", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "review_request" }, 60);
    getUserById.mockResolvedValue({
      data: { user: { id: "user-1", app_metadata: { status: "pending_review" } } },
      error: null,
    });
    const target = await captureRedirect(declineRequestAction(fd({ token })));
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(target).toBe("/review?done=declined");
  });

  it("redirects to alreadyhandled without deleting when the request is no longer pending", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "review_request" }, 60);
    getUserById.mockResolvedValue({
      data: { user: { app_metadata: { status: "pending_activation" } } },
      error: null,
    });
    const target = await captureRedirect(declineRequestAction(fd({ token })));
    expect(target).toBe("/review?done=alreadyhandled");
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
