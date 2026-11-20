import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { authFetch } from "../src/api/client";
import { currentOAuthQuery, goTo } from "../src/auth/oauth";
import { passkeysSupported, signInWithPasskey } from "../src/auth/passkey";
import { useAuth } from "../src/auth/session";
import { signInErrorMessage } from "../src/auth/sign-in-error";
import { Body, Button, ErrorText, Heading, Masthead, Screen, TextField } from "../src/ui";

/** Email + password, and a passkey button where supported. No sign-up and no "forgot password" (single owner). */
export default function SignIn() {
  const { status, signIn, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const oauthQuery = currentOAuthQuery();

  if (status === "signedIn" && !oauthQuery) return <Redirect href="/" />;

  async function afterSignIn() {
    if (oauthQuery) {
      // Signing in for an MCP client (e.g. Claude): continue the OAuth flow to the consent screen.
      const res = await authFetch<{ redirect_uri?: string; url?: string }>("/oauth2/continue", {
        body: { postLogin: true, oauth_query: oauthQuery },
      });
      const next = res.redirect_uri ?? res.url;
      if (next) return goTo(next);
    }
    router.replace("/");
  }

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email.trim(), password);
      await afterSignIn();
    } catch (e) {
      setError(new Error(signInErrorMessage(e)));
    } finally {
      setBusy(false);
    }
  }

  async function passkey() {
    setBusy(true);
    setError(undefined);
    try {
      await signInWithPasskey();
      await refresh();
      await afterSignIn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen narrow testID="screen-sign-in">
      <Masthead />
      <View className="gap-1">
        <Heading>Sign in</Heading>
        {oauthQuery ? <Body muted>Sign in to connect an AI assistant to your account.</Body> : null}
      </View>
      <TextField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
        testID="email"
      />
      <TextField
        label="Password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        testID="password"
      />
      <ErrorText error={error} />
      <View className="flex-row flex-wrap items-center gap-3">
        <Button
          label="Sign in"
          onPress={() => void submit()}
          busy={busy}
          disabled={!email || !password}
          testID="sign-in"
        />
        {passkeysSupported ? (
          <Button
            label="Sign in with a passkey"
            variant="ghost"
            onPress={() => void passkey()}
            disabled={busy}
          />
        ) : null}
      </View>
    </Screen>
  );
}
