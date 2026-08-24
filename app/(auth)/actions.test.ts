import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const cookieSet = vi.fn();

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
  cookies: async () => ({ set: cookieSet }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword,
      signOut,
      resetPasswordForEmail,
      updateUser,
    },
  }),
}));

process.env.SESSION_DEADLINE_SECRET = "test-secret-do-not-use-in-prod";

const {
  loginAction,
  logoutAction,
  requestPasswordResetAction,
  updatePasswordAction,
  updateSessionLifetimePrefAction,
} = await import("@/app/(auth)/actions");
const { SESSION_DEADLINE_COOKIE } = await import("@/lib/session-deadline");

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
  signInWithPassword.mockReset();
  signOut.mockReset();
  resetPasswordForEmail.mockReset();
  updateUser.mockReset();
  cookieSet.mockReset();
});

describe("loginAction", () => {
  it("redirects to /account and mints a deadline cookie from the user's preference", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: { session_lifetime_pref: "7d" } } },
      error: null,
    });
    const target = await captureRedirect(
      loginAction(fd({ email: "a@b.com", password: "secret-123" })),
    );
    expect(target).toBe("/account");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "secret-123",
    });
    expect(cookieSet).toHaveBeenCalledWith(
      SESSION_DEADLINE_COOKIE,
      expect.any(String),
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 7 }),
    );
  });

  it("defaults to the 1d deadline when no preference is stored", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    });
    await captureRedirect(
      loginAction(fd({ email: "a@b.com", password: "secret-123" })),
    );
    expect(cookieSet).toHaveBeenCalledWith(
      SESSION_DEADLINE_COOKIE,
      expect.any(String),
      expect.objectContaining({ maxAge: 60 * 60 * 24 }),
    );
  });

  it("redirects back with error on invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const target = await captureRedirect(
      loginAction(fd({ email: "a@b.com", password: "secret-123" })),
    );
    expect(target).toBe(
      "/login?error=" + encodeURIComponent("Invalid login credentials"),
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("rejects missing password before hitting Supabase", async () => {
    const target = await captureRedirect(
      loginAction(fd({ email: "a@b.com" })),
    );
    expect(target).toMatch(/^\/login\?error=/);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("updateSessionLifetimePrefAction", () => {
  it("persists a valid preference to user_metadata", async () => {
    updateUser.mockResolvedValue({ error: null });
    const result = await updateSessionLifetimePrefAction(
      null,
      fd({ pref: "7d" }),
    );
    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({
      data: { session_lifetime_pref: "7d" },
    });
    // Preference changes never retroactively extend the running session.
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("rejects a value outside the preset list without calling Supabase", async () => {
    const result = await updateSessionLifetimePrefAction(
      null,
      fd({ pref: "30d" }),
    );
    expect(result.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("surfaces a Supabase error", async () => {
    updateUser.mockResolvedValue({ error: { message: "Not authenticated" } });
    const result = await updateSessionLifetimePrefAction(
      null,
      fd({ pref: "1h" }),
    );
    expect(result).toEqual({ ok: false, error: "Not authenticated" });
  });
});

describe("logoutAction", () => {
  it("signs out and redirects home", async () => {
    signOut.mockResolvedValue({ error: null });
    const target = await captureRedirect(logoutAction());
    expect(target).toBe("/");
    expect(signOut).toHaveBeenCalled();
  });

  it("logs and still redirects when signOut errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    signOut.mockResolvedValue({ error: { message: "boom" } });
    const target = await captureRedirect(logoutAction());
    expect(target).toBe("/");
    expect(consoleError).toHaveBeenCalledWith("[logout] signOut failed:", "boom");
    consoleError.mockRestore();
  });
});

describe("requestPasswordResetAction", () => {
  it("triggers Supabase recovery and redirects to neutral confirmation", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const target = await captureRedirect(
      requestPasswordResetAction(fd({ email: " a@b.com " })),
    );
    expect(target).toBe("/forgot?sent=1");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "https://khaos-id.test/reset",
    });
  });

  it("yields the same neutral confirmation when Supabase reports an error (no enumeration)", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: "User not found" },
    });
    const target = await captureRedirect(
      requestPasswordResetAction(fd({ email: "ghost@b.com" })),
    );
    expect(target).toBe("/forgot?sent=1");
  });

  it("rejects missing email before hitting Supabase", async () => {
    const target = await captureRedirect(
      requestPasswordResetAction(fd({})),
    );
    expect(target).toMatch(/^\/forgot\?error=/);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("updatePasswordAction", () => {
  it("redirects to /account on success", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    const target = await captureRedirect(
      updatePasswordAction(fd({ password: "pw-abc-123" })),
    );
    expect(target).toBe("/account");
    expect(updateUser).toHaveBeenCalledWith({ password: "pw-abc-123" });
  });

  it("redirects back with error when Supabase rejects", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { message: "Recovery session expired" },
    });
    const target = await captureRedirect(
      updatePasswordAction(fd({ password: "pw-abc-123" })),
    );
    expect(target).toBe(
      "/reset/confirm?error=" +
        encodeURIComponent("Recovery session expired"),
    );
  });

  it("rejects short password before hitting Supabase", async () => {
    const target = await captureRedirect(
      updatePasswordAction(fd({ password: "short" })),
    );
    expect(target).toMatch(/^\/reset\/confirm\?error=/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects empty password before hitting Supabase", async () => {
    const target = await captureRedirect(updatePasswordAction(fd({})));
    expect(target).toMatch(/^\/reset\/confirm\?error=/);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
