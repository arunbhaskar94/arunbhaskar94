import { auth } from "@/lib/firebase/client";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return fallback;
}

export async function fetcher<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("An authenticated user is required to make API requests.");
  }

  const token = await currentUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(input, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(getErrorMessage(body, response.statusText), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}