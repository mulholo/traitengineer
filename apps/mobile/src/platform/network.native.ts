import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";

/** Native: feed connectivity from expo-network into TanStack Query so mutations pause/resume. */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false));
    return () => sub.remove();
  });
}
