import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * "Catalog" design language: the app's one visual language. Shared controls live in ./index.tsx (which
 * re-exports this file); this file holds the table primitives.
 *
 * - Ruled tables and lines instead of cards; no radii, shadows or pills.
 * - System font throughout. `caption` (13px) for content and data, `micro` (11px) upper case for column heads
 *   and field labels, `title` for a page's subject. Numbers use tabular figures so they line up.
 * - Light mode is a printed parts catalog (near-black ink, blue links, grey bands, a yellow highlighter for the
 *   selected option and the row under the pointer); dark mode an amber terminal (amber ink, cyan links, a blue
 *   bar). Tokens: `paper`, `ink`, `dim`, `rule`, `rule-strong`, `band`, `link`, `mark`, `alert` in global.css.
 * - Hover changes a background, never the text's weight or decoration.
 * - Never use `dark:` classes: dark mode comes only from the token values in global.css. (With darkMode "media",
 *   NativeWind 4's web runtime throws "Cannot manually set color scheme" as soon as one `dark:` class exists.)
 * - Pages don't repeat their name from the navigation; the page's subject (a target, an entry) is its heading.
 * - An action that adds to a table is the table's last row ("+ New target").
 * - Controls keep the 44pt minimum: the density comes from the content, not from smaller targets.
 */

/** Page wrapper: paper background, left-aligned like a catalog page, wide enough for a table. */
export function Page({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]} testID={testID}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-[1120px] px-gutter pb-8 pt-2">{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Single-choice filter as a line of links with counts; the current choice is marked like a highlighter. */
export function FilterLinks<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={props.label}
      className="flex-row flex-wrap pl-1 md:pl-0"
    >
      {props.options.map((o) => {
        const selected = o.value === props.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.count === undefined ? o.label : `${o.label}, ${o.count}`}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => props.onChange(o.value)}
            className="group min-h-tap min-w-tap items-center justify-center md:pr-2"
          >
            <View
              className={`flex-row items-baseline gap-1 px-1.5 py-0.5 group-hover:bg-mark ${selected ? "bg-mark" : ""}`}
            >
              <Text className={`text-caption ${selected ? "font-semibold text-ink" : "text-link"}`}>
                {o.label}
              </Text>
              {o.count === undefined ? null : (
                <Text className="text-caption tabular-nums text-dim">{o.count}</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Column-head row of a table. Hidden from assistive tech: rows are single links whose label spells the values
 * out, so the heads would only be read as stray text.
 */
export function TableHead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className={`flex-row items-end border-b border-rule-strong px-2 pb-1 ${className}`}
    >
      {children}
    </View>
  );
}

/** One column head. `className` carries the column's width (shared with the cells below it). */
export function ColumnHead(props: { children: string; className?: string; numeric?: boolean }) {
  return (
    <View className={`${props.className ?? ""} ${props.numeric ? "items-end" : ""}`}>
      <Text className={`text-micro uppercase tracking-wide text-dim ${props.numeric ? "text-right" : ""}`}>
        {props.children}
      </Text>
    </View>
  );
}

/** Grey band that opens a group of rows. */
export function Band({ title }: { title: string }) {
  return (
    <View className="bg-band px-2 py-1">
      <Text accessibilityRole="header" aria-level={2} className="text-caption text-ink">
        {title}
      </Text>
    </View>
  );
}

/** A line of text where a table's rows would be: loading or empty. */
export function TableNote({ children }: { children: ReactNode }) {
  return <Text className="border-b border-rule px-2 py-3 text-caption text-dim">{children}</Text>;
}

/** The table's own action, as its last row ("+ New target"): adding here adds to this table. */
export function TableAction(props: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      testID={props.testID}
      className="min-h-tap flex-row items-center px-2 hover:bg-mark active:bg-mark"
    >
      <Text className="text-caption text-link">+ {props.label}</Text>
    </Pressable>
  );
}

const SPARK_HEIGHT = 16;

/** Bars one text line high: one per value, scaled to the largest. Decorative; say the numbers in a label. */
export function Spark({ points }: { points: readonly { key: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="flex-row items-end gap-[2px]"
      style={{ height: SPARK_HEIGHT }}
    >
      {points.map((p) => (
        <View
          key={p.key}
          className={`w-[6px] ${p.value > 0 ? "bg-ink" : "bg-rule-strong"}`}
          style={{ height: p.value > 0 ? Math.max(3, Math.round((p.value / max) * SPARK_HEIGHT)) : 1 }}
        />
      ))}
    </View>
  );
}
