import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import type { Request } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export async function verifyRequest(request: Request): Promise<DecodedIdToken> {
  const authorization = request.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new RequestError(401, "A valid Firebase ID token is required.");
  }

  try {
    return await getAuth().verifyIdToken(match[1], true);
  } catch {
    throw new RequestError(401, "The Firebase ID token is invalid or expired.");
  }
}

export function requireAnon(identity: DecodedIdToken): void {
  if (!identity.uid) {
    throw new RequestError(401, "Authentication is required.");
  }
  if (identity.firebase.sign_in_provider !== "anonymous" && identity.email_verified !== true) {
    throw new RequestError(403, "Verify your email or continue with an anonymous session.");
  }
}

export function requireVerified(identity: DecodedIdToken): void {
  if (!identity.uid || identity.email_verified !== true) {
    throw new RequestError(403, "Verify your email to use this feature.");
  }
}

export function requireAdmin(identity: DecodedIdToken): void {
  requireVerified(identity);
  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = identity.email;

  if (!adminEmail || !userEmail || userEmail !== adminEmail) {
    throw new RequestError(403, "Administrator access is required.");
  }
}

export function isAnonymousIdentity(identity: DecodedIdToken): boolean {
  return identity.firebase.sign_in_provider === "anonymous";
}