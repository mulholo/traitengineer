/** Web: push notifications are not supported in v1 (spec section 10). */
export type PermissionState = "granted" | "denied" | "undetermined" | "unsupported";

export const notificationsSupported = false;

export async function getPermissionState(): Promise<PermissionState> {
  return "unsupported";
}

export async function requestPermissionAndRegister(): Promise<PermissionState> {
  return "unsupported";
}

/** Register (or refresh) this device's push token with the API. */
export async function registerDevice(): Promise<void> {}

/** Notification categories + tap handling. */
export function useNotifications(_enabled: boolean): void {}
