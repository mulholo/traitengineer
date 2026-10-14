import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useAuth } from "../../src/auth/session";
import { Loading } from "../../src/ui";
import { NavBar, SyncBanner, useIsWide } from "../../src/ui/AppShell";

const renderNavBar = (props: Parameters<typeof NavBar>[0]) => <NavBar {...props} />;

/** Everything in (app) needs a signed-in owner. Tabs (not a stack) so switching sections never piles up screens. */
export default function AppLayout() {
  const { status } = useAuth();
  const wide = useIsWide();
  if (status === "loading") return <Loading />;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
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
