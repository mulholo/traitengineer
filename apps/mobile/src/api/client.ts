import { createApiClient, isProblem, type Problem } from "@te/client";
import { apiBaseUrl } from "../config";
import { getSessionToken } from "../platform/token";

export const api = createApiClient({ baseUrl: apiBaseUrl(), getToken: getSessionToken });

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem | undefined;
  constructor(status: number, problem: Problem | undefined) {
    super(problem?.detail ?? problem?.title ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

/** Turn an openapi-fetch result into data or a thrown ApiError. */
export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok)
    throw new ApiError(response.status, isProblem(error) ? error : undefined);
  return data as T;
}

/** Calls to Better Auth endpoints (not part of the OpenAPI document). */
export async function authFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getSessionToken();
  const url = `${apiBaseUrl()}/api/auth${path}`;
  const res = await fetch(url, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "include",
    headers: {
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Not the API: typically the Expo dev server, which answers any path with index.html and a 200.
    throw new Error(
      `Expected JSON from ${url} but got ${res.headers.get("content-type") ?? "something else"} (HTTP ${res.status}). ` +
        "Is EXPO_PUBLIC_API_URL pointing at the API?",
    );
  }
  if (!res.ok) {
    const message =
      (json as { message?: string; detail?: string } | null)?.message ??
      (json as { detail?: string } | null)?.detail;
    throw new ApiError(res.status, {
      type: "about:blank",
      title: message ?? "Request failed",
      status: res.status,
      code: "forbidden",
      ...(message ? { detail: message } : {}),
    });
  }
  return json as T;
}
