import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { authFetch } from "../src/api/client";
import { currentOAuthQuery, goTo } from "../src/auth/oauth";
import { useAuth } from "../src/auth/session";
import { Body, Button, ErrorText, Heading, Loading, Masthead, Screen } from "../src/ui";

const SCOPE_TEXT: Record<string, string> = {
  read: "Read your change targets, tools, entries and summaries",
  write: "Create and update change targets and log entries on your behalf",
  openid: "Know which account you signed in with",
  profile: "See your basic account profile",
  offline_access: "Stay connected without asking you to sign in again",
};

/** OAuth consent for MCP clients: states exactly which scopes are requested. */
export default function Consent() {
  const { status } = useAuth();
  const oauthQuery = currentOAuthQuery();
  const params = new URLSearchParams(oauthQuery ?? "");
  const clientId = params.get("client_id") ?? "";
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const client = useQuery({
    queryKey: ["oauth-client", clientId],
    queryFn: () =>
      authFetch<{ client_name?: string; name?: string }>(
        `/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
      ),
    enabled: status === "signedIn" && !!clientId,
  });

  if (status === "loading") return <Loading />;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (!oauthQuery) {
    return (
      <Screen narrow testID="screen-consent">
        <Masthead />
        <Heading>Nothing to approve</Heading>
        <Body muted>This page is used when an AI assistant asks to connect to your account.</Body>
      </Screen>
    );
  }

  async function decide(accept: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await authFetch<{ url?: string; redirect_uri?: string }>("/oauth2/consent", {
        body: { accept, oauth_query: oauthQuery },
      });
      const next = res.url ?? res.redirect_uri;
      if (next) goTo(next);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const name = client.data?.client_name ?? client.data?.name ?? "An application";
  return (
    <Screen narrow testID="screen-consent">
      <Masthead />
      <View className="gap-1">
        <Heading>Connect {name}?</Heading>
        <Body muted>{name} is asking for access to your account. It will be able to:</Body>
      </View>
      <View className="border-t border-rule">
        {scopes.map((s) => (
          <View key={s} className="border-b border-rule px-2 py-2">
            <Text className="text-caption text-ink">{SCOPE_TEXT[s] ?? s}</Text>
          </View>
        ))}
      </View>
      {scopes.includes("write") ? (
        <Body muted>
          Write access lets it log entries as you. You can revoke access by signing out other sessions in
          Settings.
        </Body>
      ) : null}
      <ErrorText error={error} />
      <View className="flex-row flex-wrap items-center gap-3">
        <Button label="Allow" onPress={() => void decide(true)} busy={busy} testID="consent-allow" />
        <Button label="Deny" variant="secondary" onPress={() => void decide(false)} disabled={busy} />
      </View>
    </Screen>
  );
}
