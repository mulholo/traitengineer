import { Link } from "expo-router";
import { Body, Heading, Screen } from "../src/ui";

export default function NotFound() {
  return (
    <Screen>
      <Heading>Not found</Heading>
      <Body muted>That page doesn't exist.</Body>
      <Link href="/" className="text-body text-primary">
        Go to Today
      </Link>
    </Screen>
  );
}
