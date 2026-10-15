/** iOS notification category with a "Log now" action; the app registers the same identifier. */
export const LOG_CATEGORY = "log_evidence";

/** Port for sending push notifications (Expo in production, a stub in tests). */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  categoryId?: string;
}

export type PushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; deviceNotRegistered: boolean };

export type PushReceipt =
  | { status: "ok" }
  | { status: "error"; message: string; deviceNotRegistered: boolean };

export interface PushSender {
  /** Returns one ticket per message, in order. */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  /** Receipts for previously returned ticket IDs (missing IDs are not ready yet). */
  getReceipts(ticketIds: string[]): Promise<Record<string, PushReceipt>>;
}

/**
 * Records messages instead of sending them. Used by tests and when push is not configured. `failTokens`
 * makes sends to those tokens return DeviceNotRegistered; `receipts` lets tests script receipt results.
 */
export function createRecordingPushSender(): PushSender & {
  sent: PushMessage[];
  failTokens: Set<string>;
  receipts: Map<string, PushReceipt>;
} {
  const sent: PushMessage[] = [];
  const failTokens = new Set<string>();
  const receipts = new Map<string, PushReceipt>();
  let n = 0;
  return {
    sent,
    failTokens,
    receipts,
    async send(messages) {
      sent.push(...messages);
      return messages.map((m) =>
        failTokens.has(m.to)
          ? { status: "error" as const, message: "DeviceNotRegistered", deviceNotRegistered: true }
          : { status: "ok" as const, id: `stub-ticket-${++n}` },
      );
    },
    async getReceipts(ids) {
      return Object.fromEntries(
        ids.flatMap((id) => (receipts.has(id) ? [[id, receipts.get(id) as PushReceipt]] : [])),
      );
    },
  };
}
