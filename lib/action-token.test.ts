import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintActionToken, verifyActionToken } from "@/lib/action-token";

beforeEach(() => {
  vi.stubEnv("ACTION_TOKEN_SECRET", "test-action-secret-do-not-use-in-prod");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mintActionToken / verifyActionToken", () => {
  it("round-trips a valid token", async () => {
    const token = await mintActionToken(
      { sub: "user-123", purpose: "invite" },
      60,
    );
    const payload = await verifyActionToken(token, "invite");
    expect(payload).toEqual({ sub: "user-123", purpose: "invite" });
  });

  it("rejects a purpose mismatch", async () => {
    const token = await mintActionToken(
      { sub: "user-123", purpose: "invite" },
      60,
    );
    await expect(verifyActionToken(token, "confirm_request")).rejects.toThrow(
      /purpose mismatch/,
    );
  });

  it("rejects a tampered signature", async () => {
    const token = await mintActionToken(
      { sub: "user-123", purpose: "review_request" },
      60,
    );
    await expect(
      verifyActionToken(`${token}x`, "review_request"),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const longAgo = Math.floor(Date.now() / 1000) - 7200;
    const token = await mintActionToken(
      { sub: "user-123", purpose: "activate_visitor" },
      3600,
      longAgo,
    );
    await expect(
      verifyActionToken(token, "activate_visitor"),
    ).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await mintActionToken(
      { sub: "user-123", purpose: "invite" },
      60,
    );
    vi.stubEnv("ACTION_TOKEN_SECRET", "a-different-secret-entirely");
    await expect(verifyActionToken(token, "invite")).rejects.toThrow();
  });

  it("throws clearly when no secret is configured", async () => {
    vi.stubEnv("ACTION_TOKEN_SECRET", "");
    await expect(
      mintActionToken({ sub: "user-123", purpose: "invite" }, 60),
    ).rejects.toThrow(/ACTION_TOKEN_SECRET/);
  });

  it("round-trips a confirm_email_change token carrying newEmail", async () => {
    const token = await mintActionToken(
      { sub: "user-123", purpose: "confirm_email_change", newEmail: "new@example.com" },
      60,
    );
    const payload = await verifyActionToken(token, "confirm_email_change");
    expect(payload).toEqual({
      sub: "user-123",
      purpose: "confirm_email_change",
      newEmail: "new@example.com",
    });
  });

  it("rejects a confirm_email_change token minted without newEmail", async () => {
    const token = await mintActionToken(
      { sub: "user-123", purpose: "confirm_email_change" },
      60,
    );
    await expect(
      verifyActionToken(token, "confirm_email_change"),
    ).rejects.toThrow(/newEmail/);
  });
});
