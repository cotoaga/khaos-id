import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
const updateUserById = vi.fn();
const signInWithPassword = vi.fn();
const mintAndSetSessionDeadlineCookie = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`__REDIRECT__:${target}`);
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById, updateUserById } },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("@/lib/session-deadline", () => ({
  mintAndSetSessionDeadlineCookie,
}));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { setCredentialsAction } = await import("@/app/activate/actions");
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
  getUserById.mockReset();
  updateUserById.mockReset();
  signInWithPassword.mockReset();
  mintAndSetSessionDeadlineCookie.mockReset();
});

describe("setCredentialsAction — invite purpose", () => {
  it("sets password + name/surname, signs in, and lands on /account", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "invite" }, 60);
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "guest@example.com",
          user_metadata: {},
          app_metadata: { source: "invited", status: "pending_invite" },
        },
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({ error: null });

    const target = await captureRedirect(
      setCredentialsAction(
        fd({ token, purpose: "invite", name: "Ada", surname: "Lovelace", password: "correct-horse" }),
      ),
    );

    expect(updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        password: "correct-horse",
        email_confirm: true,
        user_metadata: { name: "Ada", surname: "Lovelace" },
        app_metadata: { source: "invited" },
      }),
    );
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "guest@example.com",
      password: "correct-horse",
    });
    expect(target).toBe("/account");
  });

  it("rejects when the invite was already consumed", async () => {
    const token = await mintActionToken({ sub: "user-1", purpose: "invite" }, 60);
    getUserById.mockResolvedValue({
      data: { user: { app_metadata: { status: undefined } } },
      error: null,
    });
    const target = await captureRedirect(
      setCredentialsAction(
        fd({ token, purpose: "invite", name: "A", surname: "B", password: "correct-horse" }),
      ),
    );
    expect(target).toMatch(/^\/activate\?token=.*error=/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("setCredentialsAction — activate_visitor purpose", () => {
  it("sets only the password and preserves existing user_metadata", async () => {
    const token = await mintActionToken({ sub: "user-2", purpose: "activate_visitor" }, 60);
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "visitor@example.com",
          user_metadata: { name: "Grace", surname: "Hopper" },
          app_metadata: { source: "requested", tier: "visitor", status: "pending_activation" },
        },
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({ error: null });

    const target = await captureRedirect(
      setCredentialsAction(
        fd({ token, purpose: "activate_visitor", password: "correct-horse" }),
      ),
    );

    expect(updateUserById).toHaveBeenCalledWith(
      "user-2",
      expect.objectContaining({
        user_metadata: { name: "Grace", surname: "Hopper" },
        app_metadata: { source: "requested", tier: "visitor" },
      }),
    );
    expect(target).toBe("/account");
  });
});

describe("setCredentialsAction — validation", () => {
  it("rejects a short password without touching Supabase", async () => {
    const token = await mintActionToken({ sub: "user-3", purpose: "activate_visitor" }, 60);
    const target = await captureRedirect(
      setCredentialsAction(fd({ token, purpose: "activate_visitor", password: "short" })),
    );
    expect(target).toMatch(/^\/activate\?token=.*error=/);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("rejects an invalid token with a clean message", async () => {
    const target = await captureRedirect(
      setCredentialsAction(
        fd({ token: "garbage", purpose: "activate_visitor", password: "correct-horse" }),
      ),
    );
    expect(target).toMatch(/^\/activate\?token=garbage&error=/);
  });
});
