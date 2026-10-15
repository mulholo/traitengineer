import type { ProblemCode } from "@te/contracts";
import { isDomainError, type FieldIssue } from "@te/core";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { noopReporter, type ErrorReporter } from "../observability.ts";
import type { AppEnv } from "./types.ts";

const titles: Record<ProblemCode, string> = {
  validation_failed: "Validation failed",
  unauthenticated: "Authentication required",
  forbidden: "Forbidden",
  insufficient_scope: "Insufficient scope",
  not_found: "Not found",
  conflict: "Conflict",
  rate_limited: "Too many requests",
  unknown_tool_type: "Unknown tool type",
  internal_error: "Internal server error",
};

export const statusFor: Record<ProblemCode, ContentfulStatusCode> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  insufficient_scope: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unknown_tool_type: 400,
  internal_error: 500,
};

/** RFC 9457 problem+json response. */
export function problem(
  c: Context,
  code: ProblemCode,
  detail?: string,
  extra: { errors?: FieldIssue[]; headers?: Record<string, string> } = {},
): Response {
  const status = statusFor[code];
  const body = {
    type: `https://traitengineer.dev/problems/${code.replaceAll("_", "-")}`,
    title: titles[code],
    status,
    code,
    ...(detail ? { detail } : {}),
    instance: c.req.path,
    ...(extra.errors && extra.errors.length > 0 ? { errors: extra.errors } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json", ...extra.headers },
  });
}

/** Global error handler: domain errors → problem+json; everything else → 500 without leaking details. */
export function createOnError(report: ErrorReporter) {
  return (err: Error, c: Context<AppEnv>): Response => onError(err, c, report);
}

export function onError(err: Error, c: Context<AppEnv>, report: ErrorReporter = noopReporter): Response {
  if (isDomainError(err)) return problem(c, err.code, err.message, { errors: err.issues });
  if (err instanceof HTTPException) {
    if (err.status === 401) return problem(c, "unauthenticated");
    if (err.status === 400) return problem(c, "validation_failed", err.message);
    return err.getResponse();
  }
  c.get("log")?.error({ err }, "unhandled error");
  const userId = c.get("principal")?.userId;
  const requestId = c.get("requestId");
  report(err, { path: c.req.path, ...(userId ? { userId } : {}), ...(requestId ? { requestId } : {}) });
  return problem(c, "internal_error");
}
