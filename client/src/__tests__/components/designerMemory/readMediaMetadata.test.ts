import { afterEach, expect, it, vi } from "vitest";
import { readMediaMetadata } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/readMediaMetadata";
import type { MediaResource } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/resourceInventory";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const resource = (url: string): MediaResource => ({
  key: url,
  url,
  kind: "image",
  instances: 1,
});

it("requests scoped local metadata with the encoded filename preserved", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sizeBytes: 123, width: 4000, height: 3000 }),
  });
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  const data = await readMediaMetadata(
    resource("http://localhost:3000/E1/img/large%20photo.png"),
    "E1",
    "http://localhost:3000",
    signal,
  );
  const endpoint = new URL(fetcher.mock.calls[0][0]);
  expect(endpoint.pathname).toBe("/api/media-memory-metadata/E1");
  expect(endpoint.searchParams.get("file")).toBe("img/large%20photo.png");
  expect(fetcher.mock.calls[0][1].signal).toBe(signal);
  expect(data).toEqual({ sizeBytes: 123, width: 4000, height: 3000 });
});

it("uses a remote image's natural dimensions and leaves file size unknown when HEAD lacks it", async () => {
  const image = document.createElement("img");
  Object.defineProperties(image, {
    naturalWidth: { value: 4000 },
    naturalHeight: { value: 3000 },
  });
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        return image;
      }
    },
  );
  const fetcher = vi.fn().mockResolvedValue(new Response(null));
  vi.stubGlobal("fetch", fetcher);
  const ready = readMediaMetadata(
    resource("https://media.test/photo.png"),
    "E1",
    "http://localhost:3000",
    new AbortController().signal,
  );
  image.dispatchEvent(new Event("load"));
  expect(await ready).toEqual({ width: 4000, height: 3000 });
  expect(fetcher.mock.calls[0][1].method).toBe("HEAD");
  expect(image.hasAttribute("src")).toBe(false);
});

it("releases a remote metadata probe when the editor closes", async () => {
  const image = document.createElement("img");
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        return image;
      }
    },
  );
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  const ready = readMediaMetadata(
    resource("https://media.test/photo.png"),
    "E1",
    "http://localhost:3000",
    controller.signal,
  );
  const rejected = expect(ready).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await rejected;
  expect(image.hasAttribute("src")).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
