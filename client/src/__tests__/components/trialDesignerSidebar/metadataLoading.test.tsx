import {
  API_URL,
  act,
  afterEach,
  beforeEach,
  createDeferred,
  describe,
  expect,
  fetchMock,
  it,
  okJson,
  renderHook,
  useComponentMetadata,
  vi,
  waitFor,
} from "./testHarness";

describe("TrialDesigner component metadata and sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads component metadata using the kebab-case component endpoint", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        name: "button-response-component",
        version: "1.0.0",
        parameters: {
          choices: { type: "string_array", default: ["Continue"] },
        },
      }),
    );

    const { result } = renderHook(() =>
      useComponentMetadata("ButtonResponseComponent"),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/component-metadata/button-response`,
    );
    expect(result.current.metadata).toEqual({
      name: "button-response-component",
      version: "1.0.0",
      parameters: {
        choices: { type: "string_array", default: ["Continue"] },
      },
    });
    expect(result.current.error).toBeNull();
  });

  it("reports component metadata load errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValue(okJson({}, false));

    const { result } = renderHook(() => useComponentMetadata("ImageComponent"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadata).toBeNull();
    expect(result.current.error).toBe(
      "Failed to load metadata for ImageComponent",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading component metadata:",
      expect.any(Error),
    );
  });

  it("ignores stale component metadata responses after componentType changes", async () => {
    const slowImageResponse = createDeferred<Response>();
    const fastVideoResponse = createDeferred<Response>();
    fetchMock().mockImplementation((url: string) => {
      if (url.includes("/image")) return slowImageResponse.promise;
      return fastVideoResponse.promise;
    });

    const { result, rerender } = renderHook(
      ({ componentType }: { componentType: string | null }) =>
        useComponentMetadata(componentType),
      { initialProps: { componentType: "ImageComponent" } },
    );

    rerender({ componentType: "VideoComponent" });

    await act(async () => {
      fastVideoResponse.resolve(
        okJson({
          name: "video-component",
          version: "1.0.0",
          parameters: { video: { type: "video_array" } },
        }),
      );
      await fastVideoResponse.promise;
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.metadata?.name).toBe("video-component");
    });

    await act(async () => {
      slowImageResponse.resolve(
        okJson({
          name: "image-component",
          version: "1.0.0",
          parameters: { image: { type: "image" } },
        }),
      );
      await slowImageResponse.promise;
      await Promise.resolve();
    });

    expect(result.current.metadata?.name).toBe("video-component");
  });

  it("ignores stale component metadata errors after unmount", async () => {
    const lateError = createDeferred<Response>();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock().mockReturnValue(lateError.promise);

    const { unmount } = renderHook(() =>
      useComponentMetadata("ImageComponent"),
    );

    unmount();

    await act(async () => {
      lateError.reject(new Error("late metadata failure"));
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("clears component metadata when no component is selected", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        name: "text-component",
        version: "1.0.0",
        parameters: { text: { type: "html_string" } },
      }),
    );

    const { result, rerender } = renderHook(
      ({ componentType }: { componentType: string | null }) =>
        useComponentMetadata(componentType),
      { initialProps: { componentType: "TextComponent" } },
    );

    await waitFor(() => {
      expect(result.current.metadata?.name).toBe("text-component");
    });

    rerender({ componentType: null });

    expect(result.current).toEqual({
      metadata: null,
      loading: false,
      error: null,
    });
  });
});
