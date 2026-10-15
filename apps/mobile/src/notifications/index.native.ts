import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { api, unwrap } from "../api/client";
import { pathFromDeepLink } from "./deep-link";

export type PermissionState = "granted" | "denied" | "undetermined" | "unsupported";

export const notificationsSupported = true;

/** Must match LOG_CATEGORY in @te/core (the server sets it on every reminder). */
const LOG_CATEGORY = "log_evidence";
const LOG_NOW_ACTION = "log_now";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

void Notifications.setNotificationCategoryAsync(LOG_CATEGORY, [
  { identifier: LOG_NOW_ACTION, buttonTitle: "Log now", options: { opensAppToForeground: true } },
]);

if (Platform.OS === "android") {
  void Notifications.setNotificationChannelAsync("reminders", {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Register (or refresh) this device's Expo push token with the API. Safe to call on every app start. */
export async function registerDevice(): Promise<void> {
  if ((await getPermissionState()) !== "granted") return;
  const id = projectId();
  if (!id) {
    console.warn("No EAS project ID configured; push token not registered (docs/setup.md, Expo step).");
    return;
  }
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await unwrap(
    api.POST("/v1/devices", {
      body: {
        expoPushToken,
        platform: Platform.OS === "android" ? "android" : "ios",
        deviceName: Device.deviceName ?? Device.modelName ?? "",
      },
    }),
  );
}

export async function requestPermissionAndRegister(): Promise<PermissionState> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (status === "granted")
    await registerDevice().catch((e: unknown) => console.warn("Push registration failed", e));
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/**
 * While signed in: refresh the push token on every app start, and route notification taps — from a cold
 * start or while running — to the reminder's deep link (the quick-log sheet). "Log now" does the same.
 */
export function useNotifications(enabled: boolean): void {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (enabled) void registerDevice().catch((e: unknown) => console.warn("Push registration failed", e));
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !response) return;
    const action = response.actionIdentifier;
    if (action !== Notifications.DEFAULT_ACTION_IDENTIFIER && action !== LOG_NOW_ACTION) return;
    const path = pathFromDeepLink(response.notification.request.content.data?.["url"]);
    if (path) router.push(path as Parameters<typeof router.push>[0]);
    void Notifications.clearLastNotificationResponseAsync();
  }, [enabled, response]);
}
