import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send },
  })),
}));

const { sendMail } = await import("@/lib/mail/resend");

beforeEach(() => {
  send.mockReset();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("KHAOS_ID_MASTER", "kurt@cotoaga.ai");
});

describe("sendMail", () => {
  it("sends via Resend with the khaos-id from address", async () => {
    send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
    await sendMail({
      to: "visitor@example.com",
      subject: "Confirm your request",
      html: "<p>hi</p>",
    });
    expect(send).toHaveBeenCalledWith({
      from: "khaos-id <kurt@cotoaga.ai>",
      to: "visitor@example.com",
      subject: "Confirm your request",
      html: "<p>hi</p>",
    });
  });

  it("throws when Resend reports an error", async () => {
    send.mockResolvedValue({ data: null, error: { message: "bounced" } });
    await expect(
      sendMail({ to: "x@y.com", subject: "s", html: "<p/>" }),
    ).rejects.toThrow(/Resend send failed: bounced/);
  });

  it("throws clearly when RESEND_API_KEY is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(
      sendMail({ to: "x@y.com", subject: "s", html: "<p/>" }),
    ).rejects.toThrow(/RESEND_API_KEY/);
  });

  it("throws clearly when KHAOS_ID_MASTER is unset", async () => {
    vi.stubEnv("KHAOS_ID_MASTER", "");
    await expect(
      sendMail({ to: "x@y.com", subject: "s", html: "<p/>" }),
    ).rejects.toThrow(/KHAOS_ID_MASTER/);
  });
});
