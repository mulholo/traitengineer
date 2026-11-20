import { Linking, Pressable, Text, View } from "react-native";
import { MEDITATIONS, sourceOf, type Meditation } from "../../src/features/meditations/links";
import { ColumnHead, Heading, Screen, TableHead } from "../../src/ui";

/** Column widths, shared by the head and every row. A phone folds the source under the title. */
const COL = {
  title: "flex-1",
  source: "hidden w-40 md:flex",
};
const ROW_GAP = "gap-2 md:gap-3";

/** Meditations: a hard-coded list of links (src/features/meditations/links.ts), each opening outside the app. */
export default function Meditations() {
  return (
    <Screen testID="screen-meditations">
      <Heading hidden>Meditations</Heading>
      <View>
        <TableHead className={ROW_GAP}>
          <ColumnHead className={COL.title}>Meditation</ColumnHead>
          <ColumnHead className={COL.source}>Source</ColumnHead>
        </TableHead>
        {MEDITATIONS.map((m) => (
          <MeditationRow key={m.url} meditation={m} />
        ))}
      </View>
    </Screen>
  );
}

/**
 * One meditation: the whole row is the link. It opens in the browser (a new tab on web) or, on a phone, in the
 * YouTube or Drive app when installed.
 */
function MeditationRow({ meditation }: { meditation: Meditation }) {
  const source = sourceOf(meditation.url);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${meditation.title}, opens ${source}`}
      accessibilityHint="Opens outside the app"
      testID="meditation-row"
      onPress={() => void Linking.openURL(meditation.url)}
      className={`min-h-tap flex-row items-center border-b border-rule px-2 py-1 hover:bg-mark active:bg-mark ${ROW_GAP}`}
    >
      <View className={COL.title}>
        <Text className="text-caption text-link" numberOfLines={2}>
          {meditation.title} ↗
        </Text>
        <View className="md:hidden">
          <Text className="text-caption text-dim" numberOfLines={1}>
            {source}
          </Text>
        </View>
      </View>
      <View className={COL.source}>
        <Text className="text-caption text-ink">{source}</Text>
      </View>
    </Pressable>
  );
}
