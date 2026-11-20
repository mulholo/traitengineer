import * as Localization from "expo-localization";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { addPasskey, passkeysSupported, SessionNotFreshError } from "../../src/auth/passkey";
import { useAuth } from "../../src/auth/session";
import {
  useChangePassword,
  useCreateToken,
  useDeletePasskey,
  useDevices,
  usePasskeys,
  useReauthenticate,
  useRemoveDevice,
  useRevokeSession,
  useRevokeToken,
  useSessions,
  useTokens,
  useUpdateMe,
} from "../../src/features/settings/hooks";
import {
  Body,
  Button,
  Card,
  ColumnHead,
  ErrorText,
  Heading,
  RowAction,
  Screen,
  Section,
  Sections,
  Segmented,
  TableAction,
  TableHead,
  TableNote,
  TextField,
} from "../../src/ui";

/** A form under a band: fields stacked, the submit button last and left-aligned. */
function Form({ children }: { children: ReactNode }) {
  return <View className="items-stretch gap-3 px-2 pt-3">{children}</View>;
}

/** Column widths shared by each table's head and rows. Dates fold under the name below md. */
const COL = {
  name: "flex-1",
  scope: "hidden w-24 md:flex",
  date: "hidden w-40 items-end md:flex",
  action: "w-[72px] items-end",
};
const ROW = "min-h-tap flex-row items-center gap-2 border-b border-rule px-2 md:gap-3";
const CELL = "text-caption text-ink";
const DATE = "text-right text-caption tabular-nums text-ink";

/** A row's own action, set as a link-weight word in the alert colour; still a 44pt target. */

/** Main cell: the item's name, with the secondary columns folded under it on a phone. */
function NameCell({ name, folded }: { name: string; folded: string }) {
  return (
    <View className={`py-1 ${COL.name}`}>
      <Text className={CELL} numberOfLines={2}>
        {name}
      </Text>
      <View className="md:hidden">
        <Text className="text-caption tabular-nums text-dim" numberOfLines={1}>
          {folded}
        </Text>
      </View>
    </View>
  );
}

function Account() {
  const { me } = useAuth();
  const updateMe = useUpdateMe();
  const [tz, setTz] = useState(me?.timezone ?? "");
  const deviceTz = Localization.getCalendars()[0]?.timeZone ?? undefined;
  return (
    <Section title="Account">
      <View className="border-b border-rule px-2 py-2">
        <Body>Signed in as {me?.email}</Body>
      </View>
      <Form>
        <TextField
          label="Time zone (IANA)"
          autoCapitalize="none"
          value={tz}
          onChangeText={setTz}
          hint="Used for streaks, weeks and reminders"
          testID="timezone"
        />
        {deviceTz && deviceTz !== tz ? (
          <View className="items-start">
            <Button
              label={`Use device time zone (${deviceTz})`}
              variant="ghost"
              compact
              onPress={() => setTz(deviceTz)}
            />
          </View>
        ) : null}
        <ErrorText error={updateMe.error} />
        <View className="items-start">
          <Button label="Save" busy={updateMe.isPending} onPress={() => updateMe.mutate({ timezone: tz })} />
        </View>
      </Form>
    </Section>
  );
}

function Password() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <Section title="Change password">
      <Form>
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
        <View className="items-start">
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
        </View>
      </Form>
    </Section>
  );
}

/**
 * Better Auth only registers a passkey on a session signed in within the last day. Past that, ask the owner to
 * confirm it's them (password or an existing passkey). The passkey prompt is not retried automatically: Safari
 * only creates a credential from a direct tap, so the owner taps "Add a passkey" again.
 */
function ConfirmIdentity({ onConfirmed, onCancel }: { onConfirmed: () => void; onCancel: () => void }) {
  const reauth = useReauthenticate();
  const [password, setPassword] = useState("");
  const confirm = (credential: { password: string } | { passkey: true }) =>
    reauth.mutate(credential, { onSuccess: onConfirmed });
  return (
    <Form>
      <Body>You signed in over a day ago. Confirm it's you to add a passkey.</Body>
      <TextField
        label="Password"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => password && confirm({ password })}
        testID="reauth-password"
      />
      <ErrorText error={reauth.error} />
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          label="Confirm"
          disabled={!password}
          busy={reauth.isPending}
          onPress={() => confirm({ password })}
          testID="reauth-confirm"
        />
        <Button label="Use a passkey" variant="ghost" onPress={() => confirm({ passkey: true })} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Form>
  );
}

function Passkeys() {
  const passkeys = usePasskeys(passkeysSupported);
  const del = useDeletePasskey();
  const [error, setError] = useState<unknown>();
  const [step, setStep] = useState<"idle" | "confirming" | "confirmed">("idle");
  if (!passkeysSupported) {
    return (
      <Section title="Passkeys">
        <TableNote>Passkeys can be added and used in the web app.</TableNote>
      </Section>
    );
  }
  const add = () => {
    setError(undefined);
    setStep("idle");
    addPasskey(`Passkey ${new Date().toLocaleDateString()}`).then(
      () => passkeys.refetch(),
      (e: unknown) => (e instanceof SessionNotFreshError ? setStep("confirming") : setError(e)),
    );
  };
  return (
    <Section title="Passkeys">
      <TableHead className="gap-2 md:gap-3">
        <ColumnHead className={COL.name}>Passkey</ColumnHead>
        <ColumnHead className={COL.date} numeric>
          Added
        </ColumnHead>
        <ColumnHead className={COL.action}> </ColumnHead>
      </TableHead>
      {passkeys.data?.map((p) => {
        const added = new Date(p.createdAt).toLocaleDateString();
        return (
          <View key={p.id} className={ROW}>
            <NameCell name={p.name || "Passkey"} folded={`Added ${added}`} />
            <View className={COL.date}>
              <Text className={DATE}>{added}</Text>
            </View>
            <View className={COL.action}>
              <RowAction destructive label="Remove" onPress={() => del.mutate(p.id)} />
            </View>
          </View>
        );
      })}
      <ErrorText error={error ?? passkeys.error} />
      {step === "confirming" ? (
        <ConfirmIdentity onConfirmed={() => setStep("confirmed")} onCancel={() => setStep("idle")} />
      ) : (
        <>
          {step === "confirmed" ? <TableNote>Confirmed. You can add a passkey now.</TableNote> : null}
          <TableAction label="Add a passkey" onPress={add} />
        </>
      )}
    </Section>
  );
}

function Sessions() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  return (
    <Section title="Active sessions">
      <TableHead className="gap-2 md:gap-3">
        <ColumnHead className={COL.name}>Device</ColumnHead>
        <ColumnHead className={COL.date} numeric>
          Since
        </ColumnHead>
        <ColumnHead className={COL.action}> </ColumnHead>
      </TableHead>
      <ErrorText error={sessions.error} />
      {sessions.data?.map((s) => {
        const since = new Date(s.createdAt).toLocaleString();
        return (
          <View key={s.id} className={ROW}>
            <NameCell name={s.userAgent?.slice(0, 60) || "Unknown device"} folded={`Since ${since}`} />
            <View className={COL.date}>
              <Text className={DATE}>{since}</Text>
            </View>
            <View className={COL.action}>
              <RowAction destructive label="Revoke" onPress={() => revoke.mutate(s.token)} />
            </View>
          </View>
        );
      })}
    </Section>
  );
}

function Devices() {
  const devices = useDevices();
  const remove = useRemoveDevice();
  const active = (devices.data?.items ?? []).filter((d) => !d.disabledAt);
  return (
    <Section title="Devices (push notifications)">
      <TableHead className="gap-2 md:gap-3">
        <ColumnHead className={COL.name}>Device</ColumnHead>
        <ColumnHead className={COL.date} numeric>
          Last seen
        </ColumnHead>
        <ColumnHead className={COL.action}> </ColumnHead>
      </TableHead>
      {active.length === 0 ? <TableNote>No devices registered.</TableNote> : null}
      {active.map((d) => {
        const seen = new Date(d.lastSeenAt).toLocaleDateString();
        return (
          <View key={d.id} className={ROW}>
            <NameCell name={d.deviceName || d.platform} folded={`Last seen ${seen}`} />
            <View className={COL.date}>
              <Text className={DATE}>{seen}</Text>
            </View>
            <View className={COL.action}>
              <RowAction destructive label="Remove" onPress={() => remove.mutate(d.id)} />
            </View>
          </View>
        );
      })}
    </Section>
  );
}

function Tokens() {
  const tokens = useTokens();
  const create = useCreateToken();
  const revoke = useRevokeToken();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const live = (tokens.data?.items ?? []).filter((t) => !t.revokedAt);
  return (
    <Section title="Personal access tokens">
      <View className="px-2 py-2">
        <Body muted>For scripts and local agents (e.g. Claude Code over MCP). Shown once.</Body>
      </View>
      <TableHead className="gap-2 md:gap-3">
        <ColumnHead className={COL.name}>Token</ColumnHead>
        <ColumnHead className={COL.scope}>Scope</ColumnHead>
        <ColumnHead className={COL.date} numeric>
          Last used
        </ColumnHead>
        <ColumnHead className={COL.action}> </ColumnHead>
      </TableHead>
      {live.map((t) => {
        const scopes = t.scopes.join(", ");
        const used = t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "Never used";
        return (
          <View key={t.id} className={ROW}>
            <NameCell name={t.name} folded={`${scopes} · ${t.lastUsedAt ? `Last used ${used}` : used}`} />
            <View className={COL.scope}>
              <Text className={CELL}>{scopes}</Text>
            </View>
            <View className={COL.date}>
              <Text className={DATE}>{used}</Text>
            </View>
            <View className={COL.action}>
              <RowAction destructive label="Revoke" onPress={() => revoke.mutate(t.id)} />
            </View>
          </View>
        );
      })}
      {create.data ? (
        <Card testID="new-token">
          <Body className="font-semibold">Copy this token now — it won't be shown again:</Body>
          <Body selectable>{create.data.token}</Body>
        </Card>
      ) : null}
      <Form>
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
        <View className="items-start">
          <Button
            label="Create token"
            disabled={!name.trim()}
            busy={create.isPending}
            onPress={() => create.mutate({ name: name.trim(), scope })}
          />
        </View>
      </Form>
    </Section>
  );
}

/**
 * Settings: one page of sections, each a band over a spec line, a table with its actions, or a short form; the
 * sections sit a section gap apart, with Sign out last.
 */
export default function Settings() {
  const { signOut } = useAuth();
  return (
    <Screen narrow testID="screen-settings">
      <Heading hidden>Settings</Heading>
      <Sections>
        <Account />
        <Password />
        <Passkeys />
        <Sessions />
        <Devices />
        <Tokens />
        <View className="items-start border-t border-rule px-2 pt-3">
          <Button label="Sign out" variant="danger" onPress={() => void signOut()} testID="sign-out" />
        </View>
      </Sections>
    </Screen>
  );
}
