import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import type * as ApiClient from "../api/client";
import { keys } from "../api/keys";
import { AuthProvider, useAuth } from "./session";

const mockGet = jest.fn();
jest.mock("../api/client", () => {
  const actual = jest.requireActual<typeof ApiClient>("../api/client");
  return {
    ...actual,
    api: { GET: (...args: unknown[]) => mockGet(...args) },
    authFetch: jest.fn(async () => ({})),
  };
});

const me = { id: "01927a4e-6f0b-7160-bcce-23cb1342b381", email: "sam@example.test", name: "Sam" };

function Probe() {
  const { status, signOut } = useAuth();
  return (
    <Pressable onPress={() => void signOut()}>
      <Text>{status}</Text>
    </Pressable>
  );
}

test("signing out flips the app to signed out straight away and drops cached data", async () => {
  mockGet.mockResolvedValue({ data: me, response: { ok: true, status: 200 } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.allTargets, [{ id: "t1" }]);
  await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("signedIn");

  await fireEvent.press(screen.getByText("signedIn"));

  // Without a restart: the provider's own query observer must see the sign-out.
  await screen.findByText("signedOut");
  expect(client.getQueryData(keys.me)).toBeNull();
  expect(client.getQueryData(keys.allTargets)).toBeUndefined();
});
