import type { ArchiveFile, ArchiveStore } from "@te/core";

export interface GitHubArchiveOptions {
  /** `owner/name` of the private archive repo. */
  repo: string;
  /** Fine-grained token with Contents: read and write on that repo only. */
  token: string;
  fetch?: typeof globalThis.fetch;
  apiUrl?: string;
}

/**
 * Commits a snapshot to the archive repo's default branch with the Git Data API: one tree containing every
 * file, one commit on top of the current head. The repo needs at least one commit (docs/setup.md step 1).
 */
export function createGitHubArchiveStore(opts: GitHubArchiveOptions): ArchiveStore {
  const f = opts.fetch ?? globalThis.fetch;
  const api = opts.apiUrl ?? "https://api.github.com";
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await f(`${api}/repos/${opts.repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${opts.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };

  return {
    async writeSnapshot(files: ArchiveFile[], message: string) {
      const { default_branch: branch } = await call<{ default_branch: string }>("GET", "");
      const ref = await call<{ object: { sha: string } }>("GET", `/git/ref/heads/${branch}`);
      const head = await call<{ tree: { sha: string } }>("GET", `/git/commits/${ref.object.sha}`);
      const tree = await call<{ sha: string }>("POST", "/git/trees", {
        base_tree: head.tree.sha,
        tree: files.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content })),
      });
      const commit = await call<{ sha: string }>("POST", "/git/commits", {
        message,
        tree: tree.sha,
        parents: [ref.object.sha],
      });
      await call("PATCH", `/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
      return { id: commit.sha };
    },
  };
}
