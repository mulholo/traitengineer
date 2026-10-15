/** Port for the nightly human-readable archive (a GitHub repo in production, a recording stub in tests). */
export interface ArchiveFile {
  path: string;
  content: string;
}

export interface ArchiveStore {
  /** Write all files in one commit; unchanged files are fine. Returns an identifier of the snapshot. */
  writeSnapshot(files: ArchiveFile[], message: string): Promise<{ id: string }>;
}

export function createRecordingArchiveStore(): ArchiveStore & {
  snapshots: { files: ArchiveFile[]; message: string }[];
} {
  const snapshots: { files: ArchiveFile[]; message: string }[] = [];
  return {
    snapshots,
    async writeSnapshot(files, message) {
      snapshots.push({ files, message });
      return { id: `snapshot-${snapshots.length}` };
    },
  };
}
