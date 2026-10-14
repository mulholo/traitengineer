/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  me: ["me"] as const,
  targets: (status?: string) => ["targets", status ?? "all"] as const,
  allTargets: ["targets"] as const,
  target: (id: string) => ["target", id] as const,
  summary: (id: string) => ["summary", id] as const,
  tools: (changeTargetId?: string) => ["tools", changeTargetId ?? "all"] as const,
  tool: (id: string) => ["tool", id] as const,
  entries: (filter: Record<string, string | undefined> = {}) => ["entries", filter] as const,
  allEntries: ["entries"] as const,
  entry: (id: string) => ["entry", id] as const,
  reminders: ["reminders"] as const,
  devices: ["devices"] as const,
  tokens: ["tokens"] as const,
  sessions: ["sessions"] as const,
  passkeys: ["passkeys"] as const,
};
