import * as Localization from "expo-localization";
import { useState } from "react";
import { Platform, View } from "react-native";
import { addPasskey, passkeysSupported } from "../../src/auth/passkey";
import { useAuth } from "../../src/auth/session";
import {
  fetchExport,
  useChangePassword,
  useCreateToken,
  useDeletePasskey,
  useDevices,
  usePasskeys,
  useRemoveDevice,
  useRevokeSession,
  useRevokeToken,
  useSessions,
  useTokens,
  useUpdateMe,
} from "../../src/features/settings/hooks";
import { shareExport } from "../../src/platform/share";
import { Body, Button, Caption, Card, ErrorText, Heading, Screen, Segmented, TextField } from "../../src/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Heading level={2}>{title}</Heading>
      <Card>{children}</Card>
    </View>
  );
}

function Account() {
  const { me } = useAuth();
  const updateMe = useUpdateMe();
  const [name, setName] = useState(me?.displayName ?? "");
  const [tz, setTz] = useState(me?.timezone ?? "");
  const deviceTz = Localization.getCalendars()[0]?.timeZone ?? undefined;
  return (
    <Section title="Account">
      <Caption>Signed in as {me?.email}</Caption>
      <TextField label="Display name" value={name} onChangeText={setName} />
      <TextField
        label="Time zone (IANA)"
        autoCapitalize="none"
        value={tz}
        onChangeText={setTz}
        hint="Used for streaks, weeks and reminders"
        testID="timezone"
      />
      {deviceTz && deviceTz !== tz ? (
        <Button
          label={`Use device time zone (${deviceTz})`}
          variant="ghost"
          compact
          onPress={() => setTz(deviceTz)}
        />
      ) : null}
      <ErrorText error={updateMe.error} />
      <Button
        label="Save"
        busy={updateMe.isPending}
        onPress={() => updateMe.mutate({ displayName: name, timezone: tz })}
      />
    </Section>
  );
}

function Password() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <Section title="Change password">
      <TextField
        label="Current password"
        secureTextEntry
        autoComplete="current-password"
        value={current}
        onChangeText={setCurrent}
      />
      <TextField
        label="New password"
        secureTextEntry
        autoComplete="new-password"
        value={next}
        onChangeText={setNext}
        hint="At least 12 characters. Signs out every other session."
      />
      <ErrorText error={change.error} />
      {change.isSuccess ? <Body>Password changed. Other sessions were signed out.</Body> : null}
      <Button
        label="Change password"
        disabled={!current || next.length < 12}
        busy={change.isPending}
        onPress={() =>
          change.mutate(
            { currentPassword: current, newPassword: next },
            {
              onSuccess: () => {
                setCurrent("");
                setNext("");
              },
            },
          )
        }
      />
    </Section>
  );
}

function Passkeys() {
  const passkeys = usePasskeys(passkeysSupported);
  const del = useDeletePasskey();
  const [error, setError] = useState<unknown>();
  if (!passkeysSupported) {
    return (
      <Section title="Passkeys">
        <Body muted>Passkeys can be added and used in the web app.</Body>
      </Section>
    );
  }
  return (
    <Section title="Passkeys">
      {passkeys.data?.map((p) => (
        <View key={p.id} className="flex-row items-center justify-between gap-2">
          <Body>
            {p.name || "Passkey"} · {new Date(p.createdAt).toLocaleDateString()}
          </Body>
          <Button label="Remove" variant="danger" compact onPress={() => del.mutate(p.id)} />
        </View>
      ))}
      <ErrorText error={error ?? passkeys.error} />
      <Button
        label="Add a passkey"
        variant="secondary"
        onPress={() => {
          setError(undefined);
          addPasskey(`Passkey ${new Date().toLocaleDateString()}`).then(() => passkeys.refetch(), setError);
        }}
      />
    </Section>
  );
}

function Sessions() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  return (
    <Section title="Active sessions">
      <ErrorText error={sessions.error} />
      {sessions.data?.map((s) => (
        <View key={s.id} className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Body>{s.userAgent?.slice(0, 60) || "Unknown device"}</Body>
            <Caption>Since {new Date(s.createdAt).toLocaleString()}</Caption>
          </View>
          <Button label="Revoke" variant="danger" compact onPress={() => revoke.mutate(s.token)} />
        </View>
      ))}
    </Section>
  );
}

function Devices() {
  const devices = useDevices();
  const remove = useRemoveDevice();
  const active = (devices.data?.items ?? []).filter((d) => !d.disabledAt);
  return (
    <Section title="Devices (push notifications)">
      {active.length === 0 ? <Body muted>No devices registered.</Body> : null}
      {active.map((d) => (
        <View key={d.id} className="flex-row items-center justify-between gap-2">
          <Body>
            {d.deviceName || d.platform} · last seen {new Date(d.lastSeenAt).toLocaleDateString()}
          </Body>
          <Button label="Remove" variant="danger" compact onPress={() => remove.mutate(d.id)} />
        </View>
      ))}
    </Section>
  );
}

function Tokens() {
  const tokens = useTokens();
  const create = useCreateToken();
  const revoke = useRevokeToken();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  return (
    <Section title="Personal access tokens">
      <Caption>For scripts and local agents (e.g. Claude Code over MCP). Shown once.</Caption>
      {(tokens.data?.items ?? [])
        .filter((t) => !t.revokedAt)
        .map((t) => (
          <View key={t.id} className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              <Body>
                {t.name} ({t.scopes.join(", ")})
              </Body>
              <Caption>
                {t.lastUsedAt ? `Last used ${new Date(t.lastUsedAt).toLocaleString()}` : "Never used"}
              </Caption>
            </View>
            <Button label="Revoke" variant="danger" compact onPress={() => revoke.mutate(t.id)} />
          </View>
        ))}
      {create.data ? (
        <Card testID="new-token">
          <Body className="font-semibold">Copy this token now — it won't be shown again:</Body>
          <Body selectable>{create.data.token}</Body>
        </Card>
      ) : null}
      <TextField label="Token name" value={name} onChangeText={setName} />
      <Segmented
        label="Scope"
        value={scope}
        options={[
          { value: "read", label: "Read" },
          { value: "write", label: "Read + write" },
        ]}
        onChange={setScope}
      />
      <ErrorText error={create.error} />
      <Button
        label="Create token"
        disabled={!name.trim()}
        busy={create.isPending}
        onPress={() => create.mutate({ name: name.trim(), scope })}
      />
    </Section>
  );
}

function Export() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function run(format: "json" | "markdown") {
    setBusy(true);
    setError(undefined);
    try {
      const contents = await fetchExport(format);
      const stamp = new Date().toISOString().slice(0, 10);
      await shareExport(
        `traitengineer-${stamp}.${format === "json" ? "json" : "md"}`,
        contents,
        format === "json" ? "application/json" : "text/markdown",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Export">
      <Body muted>Everything you've recorded, as Markdown (readable) or JSON (complete).</Body>
      <ErrorText error={error} />
      <View className="flex-row flex-wrap gap-2">
        <Button
          label={Platform.OS === "web" ? "Download Markdown" : "Share Markdown"}
          variant="secondary"
          busy={busy}
          onPress={() => void run("markdown")}
        />
        <Button
          label={Platform.OS === "web" ? "Download JSON" : "Share JSON"}
          variant="secondary"
          busy={busy}
          onPress={() => void run("json")}
        />
      </View>
    </Section>
  );
}

export default function Settings() {
  const { signOut } = useAuth();
  return (
    <Screen testID="screen-settings">
      <Heading>Settings</Heading>
      <Account />
      <Password />
      <Passkeys />
      <Sessions />
      <Devices />
      <Tokens />
      <Export />
      <Button label="Sign out" variant="danger" onPress={() => void signOut()} testID="sign-out" />
    </Screen>
  );
}
