import {
  API_URL,
  ComponentSidebar,
  afterEach,
  beforeEach,
  defaultSidebarProps,
  describe,
  expect,
  fetchMock,
  fireEvent,
  it,
  okJson,
  render,
  screen,
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

  it("fetches media files for ComponentSidebar and wires drag payloads", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url.includes("/api/list-files/img/")) {
        return okJson({ files: [{ url: "uploads/img/cat.png" }] });
      }
      if (url.includes("/api/list-files/vid/")) {
        return okJson({ files: [{ url: "uploads/vid/clip.mp4" }] });
      }
      if (url.includes("/api/list-files/aud/")) {
        return okJson({ files: [{ url: "uploads/aud/tone.mp3" }] });
      }
      return okJson({});
    });

    render(
      <ComponentSidebar
        {...defaultSidebarProps}
        setLeftPanelWidth={vi.fn()}
        leftPanelWidth={280}
        setShowLeftPanel={vi.fn()}
        showLeftPanel={true}
        isOpen={true}
        setComponents={vi.fn()}
        setSelectedId={vi.fn()}
        components={[]}
      />,
    );

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/list-files/img/test-exp-123`,
      );
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/list-files/vid/test-exp-123`,
      );
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/list-files/aud/test-exp-123`,
      );
    });

    fireEvent.click(screen.getByText("Image"));
    const thumbnail = await screen.findByAltText("thumbnail");
    expect(thumbnail).toHaveAttribute("src", `${API_URL}/uploads/img/cat.png`);

    const dataTransfer = { setData: vi.fn() };
    fireEvent.dragStart(thumbnail.parentElement as HTMLElement, {
      dataTransfer,
    });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "fileUrl",
      "uploads/img/cat.png",
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith("type", "ImageComponent");

    fireEvent.click(screen.getByText("Video"));
    expect(await screen.findByText("clip.mp4")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Audio")[0]);
    expect(await screen.findByText("tone.mp3")).toBeInTheDocument();
  });

  it("logs media loading failures and reopens the hidden component panel", async () => {
    const setShowLeftPanel = vi.fn();
    const mediaError = new Error("media unavailable");
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockRejectedValue(mediaError);

    render(
      <ComponentSidebar
        {...defaultSidebarProps}
        setLeftPanelWidth={vi.fn()}
        leftPanelWidth={280}
        setShowLeftPanel={setShowLeftPanel}
        showLeftPanel={false}
        isOpen={true}
        setComponents={vi.fn()}
        setSelectedId={vi.fn()}
        components={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "›" }));
    expect(setShowLeftPanel).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error loading images:",
        mediaError,
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error loading videos:",
        mediaError,
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error loading audios:",
        mediaError,
      );
    });
  });

  it("skips closed sidebar loads and defaults missing media lists to empty", async () => {
    fetchMock().mockResolvedValue(okJson({}));
    const props = {
      ...defaultSidebarProps,
      setLeftPanelWidth: vi.fn(),
      leftPanelWidth: 280,
      setShowLeftPanel: vi.fn(),
      showLeftPanel: true,
      setComponents: vi.fn(),
      setSelectedId: vi.fn(),
      components: [],
    };
    const { rerender } = render(<ComponentSidebar {...props} isOpen={false} />);

    expect(fetchMock()).not.toHaveBeenCalled();

    rerender(<ComponentSidebar {...props} isOpen />);
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByText("Image"));
    expect(screen.getByText("No images")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Video"));
    expect(screen.getByText("No videos")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Audio")[0]);
    expect(screen.getByText("No audio")).toBeInTheDocument();
  });
});
