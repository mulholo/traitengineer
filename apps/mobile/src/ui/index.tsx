import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Shared UI in the "catalog" design language (see ./catalog.tsx for the table primitives and the rules).
 * Everything here is square, ruled and flat: no cards, radii, shadows or pills; system font; colour only from
 * the catalog tokens in global.css.
 */
export * from "./catalog";

/**
 * Page wrapper: safe area, paper background, left-aligned and wide enough for a table. `narrow` keeps forms and
 * prose to a readable measure.
 */
export function Screen({
  children,
  scroll = true,
  narrow = false,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  narrow?: boolean;
  testID?: string;
}) {
  const inner = (
    <View className={`w-full gap-4 px-gutter pb-8 pt-3 ${narrow ? "max-w-[640px]" : "max-w-[1120px]"}`}>
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]} testID={testID}>
      {scroll ? (
        // Keyboard-aware: iOS insets the content so fields and buttons can always scroll above the keyboard.
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/**
 * Headings. Level 1 is the page's subject (a target's title, "Sign in"), plain and a step larger than the body;
 * level 2 is a section, set as a grey band like the status groups on /targets. `hidden` keeps a level-1 heading
 * for screen readers (and tests) on pages whose subject the navigation already shows (Today, Reminders...).
 */
export function Heading({
  children,
  level = 1,
  hidden = false,
}: {
  children: ReactNode;
  level?: 1 | 2;
  hidden?: boolean;
}) {
  if (level === 2)
    return (
      <View className="bg-band px-2 py-1">
        <Text accessibilityRole="header" aria-level={2} className="text-caption text-ink">
          {children}
        </Text>
      </View>
    );
  return (
    <Text accessibilityRole="header" aria-level={1} className={hidden ? "sr-only" : "text-title text-ink"}>
      {children}
    </Text>
  );
}

export function Body(props: {
  children: ReactNode;
  muted?: boolean | undefined;
  className?: string | undefined;
  selectable?: boolean | undefined;
}) {
  return (
    <Text
      selectable={props.selectable}
      className={`text-caption ${props.muted ? "text-dim" : "text-ink"} ${props.className ?? ""}`}
    >
      {props.children}
    </Text>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text className="text-micro text-dim">{children}</Text>;
}

/** A ruled block: a group of related lines with a hairline above and below. No box, no radius. */
export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="gap-2 border-b border-t border-rule px-2 py-3">
      {children}
    </View>
  );
}

/**
 * Buttons. `primary` is inverse video (ink block, paper text): one per form, for the thing the form is for.
 * `secondary` is a ruled box; `ghost` is a link; `danger` is a ruled box in the alert colour.
 */
type Variant = "primary" | "secondary" | "danger" | "ghost";
const variantClass: Record<Variant, string> = {
  primary: "bg-ink",
  secondary: "border border-rule-strong hover:bg-mark",
  danger: "border border-alert hover:bg-mark",
  ghost: "hover:bg-mark",
};
const variantText: Record<Variant, string> = {
  primary: "text-paper",
  secondary: "text-ink",
  danger: "text-alert",
  ghost: "text-link",
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant | undefined;
  disabled?: boolean | undefined;
  busy?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
  compact?: boolean | undefined;
}) {
  const variant = props.variant ?? "primary";
  const disabled = props.disabled || props.busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: !!disabled, busy: !!props.busy }}
      disabled={disabled}
      onPress={props.onPress}
      testID={props.testID}
      className={`min-h-tap min-w-tap flex-row items-center justify-center ${props.compact || variant === "ghost" ? "px-2" : "px-4"} ${variantClass[variant]} ${disabled ? "opacity-50" : "active:opacity-70"}`}
    >
      {props.busy ? (
        <ActivityIndicator />
      ) : (
        <Text
          className={`text-caption ${variant === "primary" ? "font-semibold" : ""} ${variantText[variant]}`}
        >
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

/** Label above a square ruled field; hint or error below. */
export function TextField(
  props: Omit<TextInputProps, "className"> & {
    label: string;
    error?: string | undefined;
    hint?: string | undefined;
  },
) {
  const { label, error, hint, multiline, ...rest } = props;
  return (
    <View className="gap-1">
      <Text className="text-micro uppercase tracking-wide text-dim">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor="#8a8a8a"
        multiline={multiline}
        className={`min-h-tap border bg-paper px-2 py-2 text-caption text-ink focus:border-ink ${error ? "border-alert" : "border-rule-strong"} ${multiline ? "min-h-[88px]" : ""}`}
        style={multiline ? { textAlignVertical: "top" } : undefined}
        {...rest}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-caption text-alert">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-caption text-dim">{hint}</Text>
      ) : null}
    </View>
  );
}

/** Single-choice row (filters, presets, difficulty): links, the current one marked like a highlighter. */
export function Segmented<T extends string>(props: {
  label: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-micro uppercase tracking-wide text-dim">{props.label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={props.label} className="flex-row flex-wrap">
        {props.options.map((o) => {
          const selected = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => props.onChange(o.value)}
              className="group min-h-tap min-w-tap items-center justify-center pr-2"
            >
              <View className={`px-1.5 py-0.5 group-hover:bg-mark ${selected ? "bg-mark" : ""}`}>
                <Text className={`text-caption ${selected ? "font-semibold text-ink" : "text-link"}`}>
                  {o.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A checkbox row: the whole 44pt row is the control; a square box, filled when on. */
export function Toggle(props: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={props.label}
      accessibilityState={{ checked: props.value }}
      onPress={() => props.onChange(!props.value)}
      testID={props.testID}
      className="min-h-tap flex-row items-center gap-2 hover:bg-mark"
    >
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className={`h-3.5 w-3.5 border border-ink ${props.value ? "bg-ink" : "bg-paper"}`}
      />
      <Text className="flex-1 text-caption text-ink">{props.label}</Text>
    </Pressable>
  );
}

export function Banner({
  children,
  tone = "info",
  testID,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "error";
  testID?: string;
}) {
  const toneClass =
    tone === "error" ? "border-alert" : tone === "warning" ? "border-ink" : "border-rule-strong";
  return (
    <View accessibilityRole="alert" testID={testID} className={`border-l-4 bg-band px-3 py-2 ${toneClass}`}>
      <Text className={`text-caption ${tone === "error" ? "text-alert" : "text-ink"}`}>{children}</Text>
    </View>
  );
}

/** Where a list would be when it has nothing in it: a ruled line of text, with an optional action under it. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="items-start gap-2 border-b border-rule px-2 py-3">
      <Text className="text-caption text-dim">{title}</Text>
      {children}
    </View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-paper p-8">
      <ActivityIndicator accessibilityLabel="Loading" />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <Text accessibilityRole="alert" className="text-caption text-alert">
      {message}
    </Text>
  );
}

/** An action inside a table row ("Remove", "Revoke", "Delete"): plain text, alert colour when destructive. */
export function RowAction(props: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      onPress={props.onPress}
      testID={props.testID}
      className="min-h-tap min-w-tap items-center justify-center px-2 hover:bg-mark active:bg-mark"
    >
      <Text className={`text-caption ${props.destructive ? "text-alert" : "text-link"}`}>{props.label}</Text>
    </Pressable>
  );
}

/** The app's name as one dim line, at the top of pages outside the app shell (sign-in, consent...). */
export function Masthead() {
  return <Text className="text-caption text-dim">Trait Engineer</Text>;
}

/**
 * A label/value list, like a spec sheet: labels in a narrow dim column, values beside them, one ruled line each.
 * Rows with an empty value are left out.
 */
export function SpecList({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
  return (
    <View className="border-t border-rule">
      {rows
        .filter((r) => r.value !== "" && r.value !== null && r.value !== undefined)
        .map((r) => (
          <View key={r.label} className="flex-row gap-3 border-b border-rule px-2 py-2">
            <Text className="w-28 text-caption text-dim md:w-40">{r.label}</Text>
            <View className="flex-1">
              {typeof r.value === "string" ? (
                <Text selectable className="text-caption text-ink">
                  {r.value}
                </Text>
              ) : (
                r.value
              )}
            </View>
          </View>
        ))}
    </View>
  );
}
