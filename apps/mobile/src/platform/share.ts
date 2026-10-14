/** Web: download the export as a file. */
export async function shareExport(filename: string, contents: string, mime: string): Promise<void> {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
