import { beforeEach, describe, expect, it, vi } from "vitest";

const createUser = vi.fn();
const sendMail = vi.fn();
const cookieSet = vi.fn();
const cookieHas = vi.fn();

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
  cookies: async () => ({ set: cookieSet, has: cookieHas }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser } },
  }),
}));

vi.mock("@/lib/mail/resend", () => ({ sendMail }));

process.env.ACTION_TOKEN_SECRET = "test-action-secret-do-not-use-in-prod";

const { submitRequestAction } = await import("@/app/request/actions");

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
  createUser.mockReset();
  sendMail.mockReset();
  cookieSet.mockReset();
  cookieHas.mockReset().mockReturnValue(false);
});

describe("submitRequestAction", () => {
  it("creates a pending user and sends a confirm mail on a clean submission", async () => {
    createUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const target = await captureRedirect(
      submitRequestAction(fd({ email: "vis@example.com", name: "Ada", surname: "Lovelace" })),
    );
    expect(target).toBe("/request?sent=1");
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "vis@example.com",
        email_confirm: false,
        user_metadata: { name: "Ada", surname: "Lovelace" },
        app_metadata: { source: "requested", status: "pending_confirmation" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "vis@example.com" }),
    );
    expect(cookieSet).toHaveBeenCalled();
  });

  it("silently no-ops when the honeypot field is filled", async () => {
    const target = await captureRedirect(
      submitRequestAction(
        fd({ email: "bot@example.com", name: "Bot", surname: "Net", company: "acme" }),
      ),
    );
    expect(target).toBe("/request?sent=1");
    expect(createUser).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("silently no-ops when the throttle cookie is already set", async () => {
    cookieHas.mockReturnValue(true);
    const target = await captureRedirect(
      submitRequestAction(fd({ email: "again@example.com", name: "A", surname: "B" })),
    );
    expect(target).toBe("/request?sent=1");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("does not reveal whether the email already exists (no enumeration)", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Email address already registered" },
    });
    const target = await captureRedirect(
      submitRequestAction(fd({ email: "exists@example.com", name: "A", surname: "B" })),
    );
    expect(target).toBe("/request?sent=1");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects missing fields before touching Supabase", async () => {
    const target = await captureRedirect(
      submitRequestAction(fd({ email: "a@b.com" })),
    );
    expect(target).toMatch(/^\/request\?error=/);
    expect(createUser).not.toHaveBeenCalled();
  });
});
