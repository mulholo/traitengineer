import "../global.css";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth/session";
import { setupOnlineManager } from "../src/platform/network";
import { useQuickActions } from "../src/platform/quick-actions";
import { withObservability } from "../src/observability";
import { createQueryClient, persister } from "../src/query/client";

setupOnlineManager();

function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useQuickActions();
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: "v1" }}
        // Entries logged offline (or before the app was closed) are replayed once the cache is restored.
        onSuccess={() => void queryClient.resumePausedMutations()}
      >
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="consent" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="log/[toolId]" options={{ presentation: "modal" }} />
          </Stack>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

export default withObservability(RootLayout);
