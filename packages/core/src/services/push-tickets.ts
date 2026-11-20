import type { PushMessage, PushTicket } from "../push.ts";
import type { ServiceDeps } from "./context.ts";

/**
 * After a send: keep successful tickets so `checkReceipts` can look them up later, and disable devices Expo says
 * are gone. Returns the distinct error messages Expo gave for the rest, so callers can report them.
 */
export async function recordTickets(
  { repos, now }: ServiceDeps,
  userId: string,
  batch: PushMessage[],
  tickets: PushTicket[],
): Promise<{ failed: number; errors: string[] }> {
  const ok: { userId: string; ticketId: string; expoPushToken: string }[] = [];
  const errors = new Set<string>();
  let failed = 0;
  for (const [i, ticket] of tickets.entries()) {
    const token = batch[i]?.to;
    if (!token) continue;
    if (ticket.status === "ok") {
      ok.push({ userId, ticketId: ticket.id, expoPushToken: token });
      continue;
    }
    failed++;
    errors.add(ticket.message);
    if (ticket.deviceNotRegistered) await repos.devices.disableByToken(token, now().toISOString());
  }
  if (ok.length > 0) await repos.pushTickets.record(ok, now().toISOString());
  return { failed, errors: [...errors] };
}
