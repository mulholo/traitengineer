import { MEDITATIONS, sourceOf } from "./links";

describe("sourceOf", () => {
  it("names known services", () => {
    expect(sourceOf("https://www.youtube.com/watch?v=pfhau72OUw4")).toBe("YouTube");
    expect(sourceOf("https://youtu.be/pfhau72OUw4")).toBe("YouTube");
    expect(sourceOf("https://m.youtube.com/watch?v=x")).toBe("YouTube");
    expect(sourceOf("https://drive.google.com/file/d/abc/view")).toBe("Google Drive");
  });

  it("falls back to the host, then to 'Link'", () => {
    expect(sourceOf("https://www.example.com/a")).toBe("example.com");
    expect(sourceOf("not a url")).toBe("Link");
  });
});

describe("MEDITATIONS", () => {
  it("are https links with titles and no duplicates", () => {
    for (const m of MEDITATIONS) {
      expect(m.title.trim()).not.toBe("");
      expect(new URL(m.url).protocol).toBe("https:");
    }
    expect(new Set(MEDITATIONS.map((m) => m.url)).size).toBe(MEDITATIONS.length);
  });
});
