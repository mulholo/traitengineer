import { createRecordingPushSender, type PushSender } from "../push.ts";
import type { Repositories } from "../repositories.ts";
import { createChangeTargetService } from "./change-targets.ts";
import { createDeviceService } from "./devices.ts";
import { createEntryService } from "./entries.ts";
import { createExportService } from "./export.ts";
import { createLoginThrottle, type LoginThrottleOptions } from "./login-throttle.ts";
import { createReminderService } from "./reminders.ts";
import { createSummaryService } from "./summaries.ts";
import { createTokenService } from "./tokens.ts";
import { createToolService } from "./tools.ts";
import { createUserService } from "./users.ts";

export type Services = ReturnType<typeof createServices>;

export interface CreateServicesOptions {
  repos: Repositories;
  now?: () => Date;
  push?: PushSender;
  loginThrottle?: LoginThrottleOptions;
}

/** Composition helper: wire repositories (and ports) into every core service. */
export function createServices(opts: CreateServicesOptions) {
  const deps = { repos: opts.repos, now: opts.now ?? (() => new Date()) };
  const push = opts.push ?? createRecordingPushSender();
  return {
    users: createUserService(deps),
    changeTargets: createChangeTargetService(deps),
    tools: createToolService(deps),
    entries: createEntryService(deps),
    summaries: createSummaryService(deps),
    reminders: createReminderService(deps, push),
    devices: createDeviceService(deps),
    tokens: createTokenService(deps),
    exports: createExportService(deps),
    loginThrottle: createLoginThrottle(deps, opts.loginThrottle),
  };
}
