import { onRequest, type Request } from "firebase-functions/v2/https";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { ZodType } from "zod";
import { enforceRateLimit, type RateLimitPolicy } from "./rateLimit";
import {
  requireAdmin,
  requireAnon,
  RequestError,
  requireVerified,
  verifyRequest,
} from "./roleGate";

type AccessLevel = "anon" | "verified" | "admin";

type SecureHandlerOptions<Input, Output> = {
  name: string;
  access: AccessLevel;
  userRateLimit: RateLimitPolicy;
  inputSchema: ZodType<Input>;
  outputSchema: ZodType<Output>;
  handler: (input: Input, identity: DecodedIdToken) => Promise<Output>;
};

const ipRateLimit: RateLimitPolicy = { limit: 100, window: "15 m" };

type HttpResponse = {
  set: (field: string, value: string) => HttpResponse;
  status: (code: number) => HttpResponse;
  json: (body: unknown) => HttpResponse;
  send: (body: string) => HttpResponse;
};

function isAllowedOrigin(origin: string): boolean {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Boolean(configuredOrigins?.includes(origin));
}

function setCors(request: Request, response: HttpResponse): boolean {
  const origin = request.header("origin");

  if (origin && !isAllowedOrigin(origin)) {
    response.status(403).json({ error: "Origin is not allowed." });
    return false;
  }

  if (origin) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
  }
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return false;
  }
  if (request.method !== "POST") {
    response.status(405).json({ error: "Only POST requests are supported." });
    return false;
  }

  return true;
}

function getClientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function getBody(request: Request): unknown {
  return request.body;
}

function sendError(response: HttpResponse, error: unknown): void {
  if (error instanceof RequestError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  console.error("Quiz API request failed.", error);
  response.status(500).json({ error: "The request could not be completed." });
}

export function createSecureHandler<Input, Output>(
  options: SecureHandlerOptions<Input, Output>,
) {
  return onRequest({ region: "asia-south1" }, async (request, response) => {
    response.set("Cache-Control", "no-store");

    try {
      if (!setCors(request, response)) {
        return;
      }

      await enforceRateLimit(`ip:${getClientIp(request)}`, ipRateLimit);

      const identity = await verifyRequest(request);
      if (options.access === "admin") {
        requireAdmin(identity);
      } else if (options.access === "verified") {
        requireVerified(identity);
      } else {
        requireAnon(identity);
      }

      await enforceRateLimit(`uid:${identity.uid}:${options.name}`, options.userRateLimit);

      const parsedInput = options.inputSchema.safeParse(getBody(request));
      if (!parsedInput.success) {
        response.status(400).json({ error: "Invalid request payload." });
        return;
      }

      const input = parsedInput.data;
      const result = await options.handler(input, identity);
      const parsedOutput = options.outputSchema.safeParse(result);
      if (!parsedOutput.success) {
        console.error("Quiz API produced invalid response data.", parsedOutput.error);
        response.status(500).json({ error: "The request could not be completed." });
        return;
      }

      response.status(200).json(parsedOutput.data);
    } catch (error: unknown) {
      sendError(response, error);
    }
  });
}
