import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

const dsn = process.env["EXPO_PUBLIC_SENTRY_DSN"];

/** Sentry only when EXPO_PUBLIC_SENTRY_DSN is set at build time. No PII; users are never identified by email. */
export const sentryEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
      return event;
    },
  });
}

/** Wrap the root component for error boundaries/native crash context when Sentry is on; identity otherwise. */
export function withObservability(Component: ComponentType): ComponentType {
  return sentryEnabled ? Sentry.wrap(Component) : Component;
}
