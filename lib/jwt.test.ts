import { beforeAll, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from "jose";
import { verifyAccessToken } from "@/lib/jwt";

const KID = "test-key";

let privateKey: KeyLike;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  privateKey = pair.privateKey;
  const publicJwk = (await exportJWK(pair.publicKey)) as JWK;
  publicJwk.kid = KID;
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";
  jwks = createLocalJWKSet({ keys: [publicJwk] });
});

async function signValid(claims: Record<string, unknown> = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: KID })
    .setIssuer("supabase-local")
    .setSubject("user-uuid-xyz")
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

describe("verifyAccessToken", () => {
  it("verifies a token signed by the matching key", async () => {
    const token = await signValid({
      email: "user@example.com",
      role: "authenticated",
    });

    const result = await verifyAccessToken(token, { jwks });

    expect(result.payload.sub).toBe("user-uuid-xyz");
    expect(result.payload.email).toBe("user@example.com");
    expect(result.payload.aud).toBe("authenticated");
    expect(result.protectedHeader.alg).toBe("ES256");
    expect(result.protectedHeader.kid).toBe(KID);
  });

  it("rejects a token with a non-matching audience", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: KID })
      .setSubject("user-uuid-xyz")
      .setAudience("service")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    await expect(verifyAccessToken(token, { jwks })).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: KID })
      .setSubject("user-uuid-xyz")
      .setAudience("authenticated")
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(privateKey);

    await expect(verifyAccessToken(token, { jwks })).rejects.toThrow();
  });

  it("rejects a token signed by a different key", async () => {
    const intruder = await generateKeyPair("ES256", { extractable: true });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: KID })
      .setSubject("user-uuid-xyz")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(intruder.privateKey);

    await expect(verifyAccessToken(token, { jwks })).rejects.toThrow();
  });

  it("honours an explicit audience override", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: KID })
      .setSubject("user-uuid-xyz")
      .setAudience("custom-aud")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const result = await verifyAccessToken(token, {
      jwks,
      audience: "custom-aud",
    });
    expect(result.payload.aud).toBe("custom-aud");
  });

  it("errors clearly when no JWKS source is configured", async () => {
    const previous = process.env.SUPABASE_JWKS_URL;
    delete process.env.SUPABASE_JWKS_URL;
    try {
      const token = await signValid();
      await expect(verifyAccessToken(token)).rejects.toThrow(
        /SUPABASE_JWKS_URL/,
      );
    } finally {
      if (previous !== undefined) process.env.SUPABASE_JWKS_URL = previous;
    }
  });
});
