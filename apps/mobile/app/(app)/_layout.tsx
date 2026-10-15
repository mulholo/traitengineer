import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { getPermissionState, notificationsSupported, useNotifications } from "../../src/notifications";
import { kvStorage } from "../../src/platform/storage";
import { useAuth } from "../../src/auth/session";
import { Loading } from "../../src/ui";
import { NavBar, SyncBanner, useIsWide } from "../../src/ui/AppShell";

const renderNavBar = (props: Parameters<typeof NavBar>[0]) => <NavBar {...props} />;

/** Everything in (app) needs a signed-in owner. Tabs (not a stack) so switching sections never piles up screens. */
export default function AppLayout() {
  const { status } = useAuth();
  const wide = useIsWide();
  const askFirst = useShouldAskForNotifications(status === "signedIn");
  useNotifications(status === "signedIn");
  if (status === "loading") return <Loading />;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (askFirst) return <Redirect href="/notifications" />;
  return (
    <View className="flex-1 bg-bg">
      <SyncBanner />
      <Tabs
        tabBar={renderNavBar}
        screenOptions={{
          headerShown: false,
          tabBarPosition: wide ? "left" : "bottom",
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Today" }} />
        <Tabs.Screen name="targets" options={{ title: "Targets", popToTopOnBlur: true }} />
        <Tabs.Screen name="reminders" options={{ title: "Reminders" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
        <Tabs.Screen name="entries/[id]" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

/** After first sign-in on a device, explain notifications once before iOS asks (never on web). */
function useShouldAskForNotifications(signedIn: boolean): boolean {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!signedIn || !notificationsSupported || kvStorage.getItem("te.notifications-asked")) return;
    void getPermissionState().then((state) => setAsk(state === "undetermined"));
  }, [signedIn]);
  return ask;
}
