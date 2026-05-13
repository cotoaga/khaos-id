// Federated-JWT verification helper.
//
// Architecture B (see docs/architecture.md): identity lives in Supabase Auth.
// Any KHAOS sibling that wants to consume a khaos-id session verifies the
// access token against the same JWKS endpoint. No shared secret. No
// out-of-band user table. The public key half is the only trust seam.

import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

export interface VerifiedJwt {
  payload: JWTPayload;
  protectedHeader: { alg: string; kid?: string; typ?: string };
}

export interface VerifyOptions {
  audience?: string;
  jwksUrl?: string;
  // Test seam: inject a pre-built key source to skip network fetch.
  jwks?: JWTVerifyGetKey;
}

let cachedRemoteJwks: JWTVerifyGetKey | undefined;
let cachedRemoteJwksUrl: string | undefined;

function getRemoteJwks(url: string): JWTVerifyGetKey {
  if (cachedRemoteJwks && cachedRemoteJwksUrl === url) return cachedRemoteJwks;
  cachedRemoteJwks = createRemoteJWKSet(new URL(url));
  cachedRemoteJwksUrl = url;
  return cachedRemoteJwks;
}

export async function verifyAccessToken(
  token: string,
  options: VerifyOptions = {},
): Promise<VerifiedJwt> {
  const audience =
    options.audience ?? process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated";
  const jwksUrl = options.jwksUrl ?? process.env.SUPABASE_JWKS_URL;

  let getKey: JWTVerifyGetKey;
  if (options.jwks) {
    getKey = options.jwks;
  } else {
    if (!jwksUrl) {
      throw new Error(
        "SUPABASE_JWKS_URL is not set — cannot verify access token",
      );
    }
    getKey = getRemoteJwks(jwksUrl);
  }

  const { payload, protectedHeader } = await jwtVerify(token, getKey, {
    audience,
  });

  return {
    payload,
    protectedHeader: protectedHeader as VerifiedJwt["protectedHeader"],
  };
}
