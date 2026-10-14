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

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}

/** Records messages instead of sending them. Used by tests and when push is not configured. */
export function createRecordingPushSender(): PushSender & { sent: PushMessage[] } {
  const sent: PushMessage[] = [];
  return {
    sent,
    async send(messages) {
      sent.push(...messages);
      return messages.map((_, i) => ({
        status: "ok" as const,
        id: `stub-${sent.length - messages.length + i}`,
      }));
    },
  };
}
