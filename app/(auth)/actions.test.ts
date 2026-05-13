import { beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`__REDIRECT__:${target}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signUp, signInWithPassword, signOut },
  }),
}));

const { loginAction, logoutAction, signupAction } = await import(
  "@/app/(auth)/actions"
);

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
  signUp.mockReset();
  signInWithPassword.mockReset();
  signOut.mockReset();
});

describe("signupAction", () => {
  it("redirects to /account on success", async () => {
    signUp.mockResolvedValue({ error: null });
    const target = await captureRedirect(
      signupAction(fd({ email: " a@b.com ", password: "secret-123" })),
    );
    expect(target).toBe("/account");
    expect(signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "secret-123",
    });
  });

  it("redirects back with error when Supabase rejects", async () => {
    signUp.mockResolvedValue({ error: { message: "User already registered" } });
    const target = await captureRedirect(
      signupAction(fd({ email: "a@b.com", password: "secret-123" })),
    );
    expect(target).toBe(
      "/signup?error=" + encodeURIComponent("User already registered"),
    );
  });

  it("rejects empty credentials before hitting Supabase", async () => {
    const target = await captureRedirect(signupAction(fd({})));
    expect(target).toMatch(/^\/signup\?error=/);
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("loginAction", () => {
  it("redirects to /account on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const target = await captureRedirect(
      loginAction(fd({ email: "a@b.com", password: "secret-123" })),
    );
    expect(target).toBe("/account");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "secret-123",
    });
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
  });

  it("rejects missing password before hitting Supabase", async () => {
    const target = await captureRedirect(
      loginAction(fd({ email: "a@b.com" })),
    );
    expect(target).toMatch(/^\/login\?error=/);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  it("signs out and redirects home", async () => {
    signOut.mockResolvedValue({ error: null });
    const target = await captureRedirect(logoutAction());
    expect(target).toBe("/");
    expect(signOut).toHaveBeenCalled();
  });
});
