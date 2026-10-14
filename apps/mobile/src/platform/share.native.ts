import { Share } from "react-native";

/** Native: open the share sheet with the export text. */
export async function shareExport(filename: string, contents: string, _mime: string): Promise<void> {
  await Share.share({ title: filename, message: contents });
}
