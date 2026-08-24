import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SESSION_LIFETIME_PREF,
  mintSessionDeadline,
  resolveSessionLifetimePref,
  sessionDeadlineCookieOptions,
  verifySessionDeadline,
} from "@/lib/session-deadline";

beforeEach(() => {
  vi.stubEnv("SESSION_DEADLINE_SECRET", "test-secret-do-not-use-in-prod");
  vi.stubEnv("COOKIE_DOMAIN", "");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSessionLifetimePref", () => {
  it("defaults to 1d when metadata is absent", () => {
    expect(resolveSessionLifetimePref(undefined)).toBe(DEFAULT_SESSION_LIFETIME_PREF);
    expect(resolveSessionLifetimePref(null)).toBe("1d");
  });

  it("defaults to 1d when the stored value is not a valid preset", () => {
    expect(resolveSessionLifetimePref({ session_lifetime_pref: "30d" })).toBe("1d");
  });

  it("passes through a valid preset", () => {
    expect(resolveSessionLifetimePref({ session_lifetime_pref: "7d" })).toBe("7d");
  });
});

describe("mintSessionDeadline / verifySessionDeadline", () => {
  it("round-trips a valid token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { token, deadline, maxAge } = await mintSessionDeadline("1h", now);
    expect(maxAge).toBe(3600);
    expect(deadline).toBe(now + 3600);

    const verified = await verifySessionDeadline(token);
    expect(verified.deadline).toBe(deadline);
  });

  it("rejects a tampered signature", async () => {
    const { token } = await mintSessionDeadline("1d");
    await expect(verifySessionDeadline(`${token}x`)).rejects.toThrow();
  });

  it("rejects an already-expired deadline", async () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const { token } = await mintSessionDeadline("1h", twoHoursAgo);
    await expect(verifySessionDeadline(token)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const { token } = await mintSessionDeadline("1d");
    vi.stubEnv("SESSION_DEADLINE_SECRET", "a-different-secret-entirely");
    await expect(verifySessionDeadline(token)).rejects.toThrow();
  });

  it("throws clearly when no secret is configured", async () => {
    vi.stubEnv("SESSION_DEADLINE_SECRET", "");
    await expect(mintSessionDeadline("1d")).rejects.toThrow(/SESSION_DEADLINE_SECRET/);
  });
});

describe("sessionDeadlineCookieOptions", () => {
  it("is httpOnly, sameSite=lax, and host-scoped when COOKIE_DOMAIN is unset", () => {
    const options = sessionDeadlineCookieOptions(3600);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(3600);
    expect(options).not.toHaveProperty("domain");
  });

  it("inherits COOKIE_DOMAIN when set", () => {
    vi.stubEnv("COOKIE_DOMAIN", ".cotoaga.ai");
    const options = sessionDeadlineCookieOptions(3600);
    expect(options.domain).toBe(".cotoaga.ai");
  });

  it("is only marked secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionDeadlineCookieOptions(3600).secure).toBe(true);
  });
});
