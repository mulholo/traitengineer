import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { requestPermissionAndRegister } from "../src/notifications";
import { kvStorage } from "../src/platform/storage";
import { Body, Button, Heading, Masthead, Screen } from "../src/ui";

export const NOTIFICATIONS_ASKED_KEY = "te.notifications-asked";

function done() {
  kvStorage.setItem(NOTIFICATIONS_ASKED_KEY, "1");
  router.replace("/");
}

/** Shown once after first sign-in (native only): explains reminders before the system permission prompt. */
export default function NotificationsPrompt() {
  const [busy, setBusy] = useState(false);
  return (
    <Screen narrow testID="screen-notifications">
      <Masthead />
      {/* .maestro/sign-in-create-log.yaml waits for this exact heading to skip the prompt. */}
      <Heading>Gentle reminders</Heading>
      <View className="gap-2">
        <Body>
          Trait Engineer can remind you at times you choose to log the moments that count. Tap a reminder (or
          "Log now") to go straight to the quick-log sheet.
        </Body>
        <Body muted>Set the schedule in Reminders. Turn notifications off any time in iOS Settings.</Body>
      </View>
      <View className="flex-row flex-wrap items-center gap-3">
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
      </View>
    </Screen>
  );
}
