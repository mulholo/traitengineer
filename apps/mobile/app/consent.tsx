import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { authFetch } from "../src/api/client";
import { currentOAuthQuery, goTo } from "../src/auth/oauth";
import { useAuth } from "../src/auth/session";
import { Body, Button, Card, ErrorText, Heading, Loading, Screen } from "../src/ui";

const SCOPE_TEXT: Record<string, string> = {
  read: "Read your change targets, tools, entries and summaries",
  write: "Create and update change targets and log entries on your behalf",
  openid: "Know which account you signed in with",
  profile: "See your display name",
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
      <Screen testID="screen-consent">
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
    <Screen testID="screen-consent">
      <Heading>Connect {name}?</Heading>
      <Body muted>{name} is asking for access to your Trait Engineer account. It will be able to:</Body>
      <Card>
        {scopes.map((s) => (
          <Body key={s}>• {SCOPE_TEXT[s] ?? s}</Body>
        ))}
      </Card>
      {scopes.includes("write") ? (
        <Body muted>
          Write access lets it log entries as you. You can revoke access by signing out other sessions in
          Settings.
        </Body>
      ) : null}
      <ErrorText error={error} />
      <View className="gap-2">
        <Button label="Allow" onPress={() => void decide(true)} busy={busy} testID="consent-allow" />
        <Button label="Deny" variant="secondary" onPress={() => void decide(false)} disabled={busy} />
      </View>
    </Screen>
  );
}
