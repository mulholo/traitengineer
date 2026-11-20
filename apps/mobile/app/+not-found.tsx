import { Link } from "expo-router";
import { Pressable, Text } from "react-native";
import { Body, Heading, Masthead, Screen } from "../src/ui";

export default function NotFound() {
  return (
    <Screen narrow>
      <Masthead />
      <Heading>Not found</Heading>
      <Body muted>That page doesn't exist.</Body>
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          className="min-h-tap self-start justify-center pr-2 hover:bg-mark"
        >
          <Text className="text-caption text-link">Go to Today</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
