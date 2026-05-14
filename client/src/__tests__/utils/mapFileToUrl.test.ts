import { describe, it, expect } from "vitest";
import { mapFileToUrl, UploadedFile } from "../../pages/ExperimentBuilder/utils/mapFileToUrl";

describe("mapFileToUrl", () => {
  const uploadedFiles: UploadedFile[] = [
    { name: "image1.png", url: "https://cdn.example.com/img/image1.png", type: "image/png" },
    { name: "audio1.mp3", url: "https://cdn.example.com/aud/audio1.mp3", type: "audio/mpeg" },
    { name: "video1.mp4", url: "https://cdn.example.com/vid/video1.mp4", type: "video/mp4" },
  ];

  it("returns the same value if falsy", () => {
    expect(mapFileToUrl(null, uploadedFiles)).toBeNull();
    expect(mapFileToUrl(undefined, uploadedFiles)).toBeUndefined();
    expect(mapFileToUrl("", uploadedFiles)).toBe("");
    expect(mapFileToUrl(0, uploadedFiles)).toBe(0);
  });

  it("returns the URL if value is already a full URL", () => {
    expect(mapFileToUrl("https://example.com/file.png", uploadedFiles)).toBe("https://example.com/file.png");
    expect(mapFileToUrl("http://localhost/img/test.jpg", uploadedFiles)).toBe("http://localhost/img/test.jpg");
  });

  it("maps filename to URL when matching by name", () => {
    expect(mapFileToUrl("image1.png", uploadedFiles)).toBe("https://cdn.example.com/img/image1.png");
    expect(mapFileToUrl("audio1.mp3", uploadedFiles)).toBe("https://cdn.example.com/aud/audio1.mp3");
  });

  it("maps filename to URL when matching by endsWith", () => {
    expect(mapFileToUrl("/path/to/image1.png", uploadedFiles)).toBe("https://cdn.example.com/img/image1.png");
  });

  it("returns original value when no match found", () => {
    expect(mapFileToUrl("nonexistent.jpg", uploadedFiles)).toBe("nonexistent.jpg");
    expect(mapFileToUrl("no-match.png", uploadedFiles)).toBe("no-match.png");
  });

  it("maps arrays recursively", () => {
    const input = ["image1.png", "audio1.mp3", "nonexistent.jpg"];
    const expected = [
      "https://cdn.example.com/img/image1.png",
      "https://cdn.example.com/aud/audio1.mp3",
      "nonexistent.jpg",
    ];
    expect(mapFileToUrl(input, uploadedFiles)).toEqual(expected);
  });

  it("handles empty uploadedFiles array", () => {
    expect(mapFileToUrl("image1.png", [])).toBe("image1.png");
  });

  it("handles mixed string types in array", () => {
    const input = ["image1.png", "https://already-a-url.com/file.png"];
    expect(mapFileToUrl(input, uploadedFiles)).toEqual([
      "https://cdn.example.com/img/image1.png",
      "https://already-a-url.com/file.png",
    ]);
  });
});
