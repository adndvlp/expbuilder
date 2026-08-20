import { describe, expect, it } from "vitest";
import { resolveMediaPreviewUrl } from "../../pages/ExperimentBuilder/utils/resolveMediaPreviewUrl";

describe("resolveMediaPreviewUrl", () => {
  const apiUrl = "http://localhost:3000";

  it("scopes relative media paths to the current experiment", () => {
    expect(
      resolveMediaPreviewUrl("img/photo.png", {
        apiUrl,
        experimentID: "experiment-123",
      }),
    ).toBe(`${apiUrl}/experiment-123/img/photo.png`);
  });

  it("maps uploaded filenames before scoping the preview URL", () => {
    expect(
      resolveMediaPreviewUrl("photo.png", {
        apiUrl,
        experimentID: "experiment-123",
        uploadedFiles: [
          { name: "photo.png", url: "img/photo.png", type: "img" },
        ],
      }),
    ).toBe(`${apiUrl}/experiment-123/img/photo.png`);
  });

  it("leaves absolute URLs unchanged", () => {
    expect(
      resolveMediaPreviewUrl("https://cdn.example.com/photo.png", {
        apiUrl,
        experimentID: "experiment-123",
      }),
    ).toBe("https://cdn.example.com/photo.png");
  });

  it("does not add an experiment prefix to unrelated relative paths", () => {
    expect(
      resolveMediaPreviewUrl("custom/photo.png", {
        apiUrl,
        experimentID: "experiment-123",
      }),
    ).toBe(`${apiUrl}/custom/photo.png`);
  });
});
