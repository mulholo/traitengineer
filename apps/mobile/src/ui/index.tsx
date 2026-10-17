import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Page wrapper: safe area, background, readable max width on wide screens. */
export function Screen({
  children,
  scroll = true,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const inner = <View className="w-full max-w-[720px] self-center gap-4 px-gutter py-4">{children}</View>;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]} testID={testID}>
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

export function Heading({ children, level = 1 }: { children: ReactNode; level?: 1 | 2 }) {
  return (
    <Text
      accessibilityRole="header"
      aria-level={level}
      className={level === 1 ? "text-display font-bold text-text" : "text-title font-semibold text-text"}
    >
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
      className={`text-body ${props.muted ? "text-muted" : "text-text"} ${props.className ?? ""}`}
    >
      {props.children}
    </Text>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text className="text-caption text-muted">{children}</Text>;
}

export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="gap-2 rounded-card border border-border bg-surface p-4">
      {children}
    </View>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variantClass: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-surface border border-border",
  danger: "bg-surface border border-danger",
  ghost: "bg-transparent",
};
const variantText: Record<Variant, string> = {
  primary: "text-on-primary",
  secondary: "text-text",
  danger: "text-danger",
  ghost: "text-primary",
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
      className={`min-h-tap min-w-tap flex-row items-center justify-center rounded-control ${props.compact ? "px-3" : "px-4"} ${variantClass[variant]} ${disabled ? "opacity-50" : "active:opacity-80"}`}
    >
      {props.busy ? (
        <ActivityIndicator />
      ) : (
        <Text className={`text-body font-semibold ${variantText[variant]}`}>{props.label}</Text>
      )}
    </Pressable>
  );
}

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
      <Text className="text-caption font-semibold text-muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor="#8a867f"
        multiline={multiline}
        className={`min-h-tap rounded-control border bg-surface px-3 py-2 text-body text-text ${error ? "border-danger" : "border-border"} ${multiline ? "min-h-[88px]" : ""}`}
        style={multiline ? { textAlignVertical: "top" } : undefined}
        {...rest}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-caption text-danger">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-caption text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

/** Single-choice row of chips (filters, presets, difficulty). */
export function Segmented<T extends string>(props: {
  label: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-caption font-semibold text-muted">{props.label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={props.label}
        className="flex-row flex-wrap gap-2"
      >
        {props.options.map((o) => {
          const selected = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => props.onChange(o.value)}
              className={`min-h-tap min-w-tap items-center justify-center rounded-control border px-3 ${selected ? "border-primary bg-primary" : "border-border bg-surface"}`}
            >
              <Text className={`text-body ${selected ? "text-on-primary font-semibold" : "text-text"}`}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The whole 44pt row is the control (the visual Switch alone is smaller than a tap target on web). */
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
      className="min-h-tap flex-row items-center justify-between gap-3"
    >
      <Text className="flex-1 text-body text-text">{props.label}</Text>
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        aria-hidden
      >
        <Switch value={props.value} tabIndex={-1} />
      </View>
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
    tone === "error" ? "border-danger" : tone === "warning" ? "border-primary" : "border-border";
  return (
    <View
      accessibilityRole="alert"
      testID={testID}
      className={`rounded-control border bg-surface px-4 py-3 ${toneClass}`}
    >
      <Text className="text-body text-text">{children}</Text>
    </View>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="items-center gap-2 rounded-card border border-dashed border-border p-6">
      <Text className="text-title text-text">{title}</Text>
      {children}
    </View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <ActivityIndicator accessibilityLabel="Loading" />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <Text accessibilityRole="alert" className="text-body text-danger">
      {message}
    </Text>
  );
}
