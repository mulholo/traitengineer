import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { requestPermissionAndRegister } from "../src/notifications";
import { kvStorage } from "../src/platform/storage";
import { Body, Button, Heading, Screen } from "../src/ui";

export const NOTIFICATIONS_ASKED_KEY = "te.notifications-asked";

function done() {
  kvStorage.setItem(NOTIFICATIONS_ASKED_KEY, "1");
  router.replace("/");
}

/** Shown once after first sign-in (native only): explains reminders before the system permission prompt. */
export default function NotificationsPrompt() {
  const [busy, setBusy] = useState(false);
  return (
    <Screen testID="screen-notifications">
      <View className="mt-8 gap-3">
        <Heading>Gentle reminders</Heading>
        <Body>
          Trait Engineer can nudge you at times you choose, so you remember to log the moments that count. Tap
          a reminder (or "Log now") to go straight to the quick-log sheet.
        </Body>
        <Body muted>
          You decide the schedule in Reminders. You can turn notifications off any time in iOS Settings.
        </Body>
      </View>
      <Button
        label="Turn on notifications"
        testID="notifications-allow"
        busy={busy}
        onPress={() => {
          setBusy(true);
          void requestPermissionAndRegister().finally(done);
        }}
      />
      <Button label="Not now" variant="ghost" onPress={done} testID="notifications-skip" />
    </Screen>
  );
}
