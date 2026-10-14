import type { Repositories } from "../repositories.ts";

export interface ServiceDeps {
  repos: Repositories;
  /** Injected so tests can control time. */
  now: () => Date;
}
