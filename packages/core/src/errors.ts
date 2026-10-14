import type { ProblemCode } from "@te/contracts";

export interface FieldIssue {
  path: string;
  message: string;
}

/** Base class for expected failures. Adapters map `code` to an HTTP status / MCP error. */
export class DomainError extends Error {
  readonly code: ProblemCode;
  readonly issues: FieldIssue[];

  constructor(code: ProblemCode, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.issues = issues;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super("not_found", `${resource} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, issues: FieldIssue[] = []) {
    super("validation_failed", message, issues);
    this.name = "ValidationError";
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
