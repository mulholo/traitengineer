/**
 * The meditations listed on the Meditations tab, in the order shown. Hard-coded on purpose: to add one, add a line
 * here. Every link needs a title (the file or video's own name); `source` is worked out from the URL.
 */
export const MEDITATIONS: readonly Meditation[] = [
  {
    title: "The Acceptance Tool Kit exercise",
    url: "https://drive.google.com/file/d/1iajrAwhhu_yN6O-oTl3rTbDX4EIpPN45/view?usp=sharing",
  },
  {
    title: "Self Compassion Break",
    url: "https://www.youtube.com/watch?v=pfhau72OUw4",
  },
  {
    title: "Drop anchor (40 seconds)",
    url: "https://drive.google.com/file/d/1b2SIH4ubk8J3mLs0drhZZgiLawNoSGIg/view",
  },
  {
    title: "Drop anchor (2 minutes)",
    url: "https://drive.google.com/file/d/1z2n0d_MZJ83lApMiusplpI7kTDLYfaAS/view?usp=drive_link",
  },
  {
    title: "Drop anchor (7 minutes)",
    url: "https://drive.google.com/file/d/1Y-TNL6HVXQjO4gzGP5PlNx6agq_E9UTq/view?usp=sharing",
  },
  {
    title: "Drop anchor (11 minutes)",
    url: "https://drive.google.com/file/d/1BWsl48YONpRspvD9ruEFyR8rCaA9MJCq/view?usp=sharing",
  },
];

export interface Meditation {
  title: string;
  url: string;
}

const SOURCES: readonly { host: RegExp; label: string }[] = [
  { host: /(^|\.)(youtube\.com|youtu\.be)$/, label: "YouTube" },
  { host: /^drive\.google\.com$/, label: "Google Drive" },
];

/** Where a link opens, for the Source column: a known service's name, else the bare host ("example.com"). */
export function sourceOf(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
  return SOURCES.find((s) => s.host.test(host))?.label ?? host;
}
