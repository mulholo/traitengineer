import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";

const posted: unknown[] = [];
jest.mock("../api/client", () => ({
  api: {
    POST: jest.fn(async (_path: string, { body }: { body: { clientId: string } }) => {
      posted.push(body);
      return { data: { id: "server-id", ...body }, response: { ok: true, status: 201 } };
    }),
  },
  unwrap: async (p: Promise<{ data: unknown }>) => (await p).data,
  ApiError: class extends Error {},
}));

// Import after the mock is registered.
import { CREATE_ENTRY, createQueryClient, type CreateEntryInput } from "./client";

const input: CreateEntryInput = {
  toolId: "01927a4e-6f0b-7160-bcce-23cb1342b381",
  clientId: "01927a4e-6f0b-7160-bcce-23cb1342b399",
  payload: { summary: "Logged on the train", tags: [] },
  source: "mobile",
};

const clients: { clear(): void }[] = [];
afterEach(() => {
  onlineManager.setOnline(true);
  posted.length = 0;
  // Clearing drops GC timers so Jest workers exit cleanly.
  for (const c of clients.splice(0)) c.clear();
});

test("an entry logged offline is paused, optimistically shown, and sent once on reconnect", async () => {
  const client = createQueryClient();
  clients.push(client);
  client.setQueryData(["entries", {}], { items: [], nextCursor: null });
  onlineManager.setOnline(false);

  const mutation = client.getMutationCache().build(client, { mutationKey: CREATE_ENTRY });
  const done = mutation.execute(input);
  await new Promise((r) => setTimeout(r, 0));

  expect(mutation.state.isPaused).toBe(true);
  expect(posted).toHaveLength(0);
  expect(
    client.getQueryData<{ items: { clientId: string }[] }>(["entries", {}])?.items.map((e) => e.clientId),
  ).toEqual([input.clientId]);

  onlineManager.setOnline(true);
  await client.resumePausedMutations();
  await done;
  expect(posted).toEqual([input]);
});

test("a paused entry survives an app restart (dehydrate → hydrate) and replays with the same clientId", async () => {
  const before = createQueryClient();
  clients.push(before);
  onlineManager.setOnline(false);
  void before
    .getMutationCache()
    .build(before, { mutationKey: CREATE_ENTRY })
    .execute(input)
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 0));
  const persisted = JSON.parse(JSON.stringify(dehydrate(before)));
  expect(persisted.mutations).toHaveLength(1);

  // "Restart": a fresh client with the same defaults restores the paused mutation and resumes it.
  const after = createQueryClient();
  clients.push(after);
  hydrate(after, persisted);
  onlineManager.setOnline(true);
  await after.resumePausedMutations();
  expect(posted).toEqual([input]);
});
