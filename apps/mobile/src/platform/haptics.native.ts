import * as Haptics from "expo-haptics";

export function successHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
