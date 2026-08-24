import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const updateUser = vi.fn();
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser },
  }),
}));

vi.mock("@/lib/mail/resend", () => ({ sendMail }));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { updateProfileAction, requestEmailChangeAction } = await import("@/app/account/actions");

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
  getUser.mockReset();
  updateUser.mockReset();
  sendMail.mockReset();
});

describe("updateProfileAction", () => {
  it("updates name and surname freely", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    updateUser.mockResolvedValue({ error: null });
    const target = await captureRedirect(
      updateProfileAction(fd({ name: "Ada", surname: "Lovelace" })),
    );
    expect(updateUser).toHaveBeenCalledWith({ data: { name: "Ada", surname: "Lovelace" } });
    expect(target).toBe("/account?profileUpdated=1");
  });

  it("rejects missing fields before touching Supabase", async () => {
    const target = await captureRedirect(updateProfileAction(fd({ name: "Ada" })));
    expect(target).toMatch(/^\/account\?error=/);
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("requestEmailChangeAction", () => {
  it("mints a token and mails the NEW address — old email is untouched", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "old@example.com" } } });
    const target = await captureRedirect(
      requestEmailChangeAction(fd({ email: "new@example.com" })),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@example.com" }),
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(target).toBe("/account?emailChangeSent=1");
  });

  it("rejects when the new address matches the current one", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "same@example.com" } } });
    const target = await captureRedirect(
      requestEmailChangeAction(fd({ email: "same@example.com" })),
    );
    expect(target).toMatch(/^\/account\?error=/);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
