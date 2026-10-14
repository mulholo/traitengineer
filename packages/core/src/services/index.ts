import type { Repositories } from "../repositories.ts";
import { createChangeTargetService } from "./change-targets.ts";
import { createEntryService } from "./entries.ts";
import { createSummaryService } from "./summaries.ts";
import { createToolService } from "./tools.ts";
import { createUserService } from "./users.ts";

export type Services = ReturnType<typeof createServices>;

/** Composition helper: wire repositories into every core service. */
export function createServices(opts: { repos: Repositories; now?: () => Date }) {
  const deps = { repos: opts.repos, now: opts.now ?? (() => new Date()) };
  return {
    users: createUserService(deps),
    changeTargets: createChangeTargetService(deps),
    tools: createToolService(deps),
    entries: createEntryService(deps),
    summaries: createSummaryService(deps),
  };
}
