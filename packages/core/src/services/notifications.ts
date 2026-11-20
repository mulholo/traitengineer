import { LOG_CATEGORY, type PushMessage, type PushSender } from "../push.ts";
import { nextOccurrence } from "../schedule.ts";
import type { ServiceDeps } from "./context.ts";
import { recordTickets } from "./push-tickets.ts";
import { reminderUrl } from "./reminders.ts";

export type NotificationService = ReturnType<typeof createNotificationService>;

export function createNotificationService({ repos, now }: ServiceDeps, push: PushSender) {
  return {
    /**
     * `reminders.dispatch`: fire every due reminder once. Each reminder is advanced with a compare-and-set
     * before sending, so overlapping or retried runs never deliver the same occurrence twice. A reminder whose
     * occurrences were missed (e.g. downtime) fires once and then moves to its next future occurrence.
     */
    async dispatchDue(limit = 100): Promise<{ fired: number; messages: number }> {
      const at = now();
      const due = await repos.reminders.listDue(at.toISOString(), limit);
      let fired = 0;
      let messages = 0;
      for (const r of due) {
        if (!r.nextFireAt) continue;
        const next = nextOccurrence(
          r.rrule,
          r.timezone,
          at.getTime() > Date.parse(r.nextFireAt) ? at : new Date(r.nextFireAt),
        );
        const won = await repos.reminders.advance(r.id, r.nextFireAt, {
          nextFireAt: next?.toISOString() ?? null,
          lastFiredAt: r.nextFireAt,
        });
        if (!won) continue;
        fired++;
        const devices = (await repos.devices.list(r.userId)).filter((d) => d.disabledAt === null);
        if (devices.length === 0) continue;
        const batch: PushMessage[] = devices.map((d) => ({
          to: d.expoPushToken,
          title: r.title,
          body: r.body,
          data: { url: reminderUrl(r), reminderId: r.id, toolId: r.toolId },
          categoryId: LOG_CATEGORY,
        }));
        const tickets = await push.send(batch);
        messages += batch.length;
        await recordTickets({ repos, now }, r.userId, batch, tickets);
      }
      return { fired, messages };
    },

    /**
     * `push.receipts`: check receipts for tickets older than a minute; disable devices Expo says are gone. Other
     * receipt errors (e.g. missing or invalid APNs credentials) are returned so the worker can log them.
     */
    async checkReceipts(limit = 1000): Promise<{ checked: number; disabled: number; errors: string[] }> {
      const at = now();
      const pending = await repos.pushTickets.listUnchecked(
        new Date(at.getTime() - 60_000).toISOString(),
        limit,
      );
      if (pending.length === 0) return { checked: 0, disabled: 0, errors: [] };
      const receipts = await push.getReceipts(pending.map((p) => p.ticketId));
      let disabled = 0;
      const errors = new Set<string>();
      const done: string[] = [];
      for (const p of pending) {
        const receipt = receipts[p.ticketId];
        if (!receipt) continue; // not ready yet; check again next run
        done.push(p.ticketId);
        if (receipt.status === "error") errors.add(receipt.message);
        if (receipt.status === "error" && receipt.deviceNotRegistered) {
          await repos.devices.disableByToken(p.expoPushToken, at.toISOString());
          disabled++;
        }
      }
      await repos.pushTickets.markChecked(done, at.toISOString());
      return { checked: done.length, disabled, errors: [...errors] };
    },
  };
}
