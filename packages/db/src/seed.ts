import { randomUUID } from "node:crypto";
import { createServices } from "@te/core";
import { eq } from "drizzle-orm";
import type { Database } from "./client.ts";
import { createRepositories } from "./repositories/index.ts";
import { accounts, users } from "./schema/index.ts";
import { insertUser } from "./testing.ts";

export const DEMO_EMAIL = "demo@traitengineer.local";

/** Small deterministic PRNG so the seed produces the same shape every time. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const summaries = [
  "Sent the proposal without a third rewrite",
  "Started the task before writing a plan",
  "Shipped the draft and asked for feedback",
  "Booked the call instead of emailing back and forth",
  "Made the decision in the meeting",
  "Spoke up first in standup",
  "Pushed the half-finished branch for early review",
  "Said no to an extra review cycle",
];
const tags = ["work", "home", "writing", "meetings", "code"];

export interface SeedResult {
  userId: string;
  created: boolean;
  changeTargetIds: string[];
  entryCount: number;
}

/**
 * Demo user with two change targets, an evidence log each, and ~40 entries over the last 8 weeks.
 * No-op (returns created=false) if the demo user already exists.
 */
export async function seedDemo(
  db: Database,
  opts: { now?: Date; passwordHash?: string } = {},
): Promise<SeedResult> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) return { userId: existing.id, created: false, changeTargetIds: [], entryCount: 0 };

  const now = opts.now ?? new Date();
  const services = createServices({ repos: createRepositories(db), now: () => now });
  const { id: userId } = await insertUser(db, {
    email: DEMO_EMAIL,
    displayName: "Demo",
    timezone: "Europe/London",
  });
  if (opts.passwordHash) {
    await db
      .insert(accounts)
      .values({ userId, providerId: "credential", accountId: userId, password: opts.passwordHash });
  }

  const action = await services.changeTargets.create(userId, {
    title: "Default to action rather than over-planning",
    oldPattern: "Rewrite and re-plan until it feels perfect, then miss the moment",
    desiredDefault: "Ship the first good-enough version and iterate",
    why: "Momentum compounds; polish rarely changes the outcome",
  });
  const voice = await services.changeTargets.create(userId, {
    title: "Speak up early",
    oldPattern: "Wait until I'm certain before sharing an opinion",
    desiredDefault: "Share the half-formed thought in the room",
    why: "My best ideas die in my head",
  });
  const tools = [
    await services.tools.create(userId, { changeTargetId: action.id, type: "evidence_log" }),
    await services.tools.create(userId, {
      changeTargetId: voice.id,
      type: "evidence_log",
      config: { askDifficulty: false },
    }),
  ];

  const rand = mulberry32(42);
  let entryCount = 0;
  for (let i = 0; i < 40; i++) {
    const tool = tools[i % 3 === 0 ? 1 : 0];
    if (!tool) continue;
    const daysAgo = Math.floor(rand() * 56);
    const occurredAt = new Date(now.getTime() - daysAgo * 86_400_000 - Math.floor(rand() * 10) * 3_600_000);
    const summary = summaries[Math.floor(rand() * summaries.length)] ?? "Did the thing";
    const tag = tags[Math.floor(rand() * tags.length)] ?? "work";
    await services.entries.create(userId, {
      toolId: tool.id,
      clientId: randomUUID(),
      occurredAt: occurredAt.toISOString(),
      source: i % 4 === 0 ? "mcp" : "mobile",
      payload: {
        summary,
        expected: "That it would go badly",
        happened: rand() > 0.3 ? "It was fine — better than fine" : "Some pushback, but useful",
        supports: "Good enough beats perfect",
        ...(rand() > 0.5 ? { uncertain: "Whether this holds under real pressure" } : {}),
        ...(tool.config["askDifficulty"] ? { difficulty: 1 + Math.floor(rand() * 5) } : {}),
        tags: [tag],
      },
    });
    entryCount++;
  }
  return { userId, created: true, changeTargetIds: [action.id, voice.id], entryCount };
}
