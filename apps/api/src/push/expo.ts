import type { PushMessage, PushReceipt, PushSender, PushTicket } from "@te/core";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";

/** PushSender backed by Expo's push service (chunked, as Expo requires). */
export function createExpoPushSender(opts: { accessToken?: string | undefined } = {}): PushSender {
  const expo = new Expo(opts.accessToken ? { accessToken: opts.accessToken } : {});
  return {
    async send(messages: PushMessage[]): Promise<PushTicket[]> {
      const tickets: PushTicket[] = Array.from({ length: messages.length });
      const valid: { index: number; message: ExpoPushMessage }[] = [];
      messages.forEach((m, index) => {
        if (!Expo.isExpoPushToken(m.to)) {
          tickets[index] = { status: "error", message: "Not an Expo push token", deviceNotRegistered: true };
          return;
        }
        valid.push({
          index,
          message: {
            to: m.to,
            title: m.title,
            ...(m.body ? { body: m.body } : {}),
            data: m.data,
            sound: "default",
            ...(m.categoryId ? { categoryId: m.categoryId } : {}),
          },
        });
      });
      let cursor = 0;
      for (const chunk of expo.chunkPushNotifications(valid.map((v) => v.message))) {
        const results = await expo.sendPushNotificationsAsync(chunk);
        for (const r of results) {
          const slot = valid[cursor++];
          if (!slot) continue;
          tickets[slot.index] =
            r.status === "ok"
              ? { status: "ok", id: r.id }
              : {
                  status: "error",
                  message: r.message,
                  deviceNotRegistered: r.details?.error === "DeviceNotRegistered",
                };
        }
      }
      return tickets;
    },

    async getReceipts(ticketIds: string[]): Promise<Record<string, PushReceipt>> {
      const out: Record<string, PushReceipt> = {};
      for (const chunk of expo.chunkPushNotificationReceiptIds(ticketIds)) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        for (const [id, r] of Object.entries(receipts)) {
          out[id] =
            r.status === "ok"
              ? { status: "ok" }
              : {
                  status: "error",
                  message: r.message,
                  deviceNotRegistered: r.details?.error === "DeviceNotRegistered",
                };
        }
      }
      return out;
    },
  };
}
