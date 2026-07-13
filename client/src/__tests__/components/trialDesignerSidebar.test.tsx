import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComponentMetadata } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata";
import ComponentSidebar from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar";
import ComponentsSection from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar/ComponentsSection";
import LeftSideBar from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar/LeftSideBar";
import ResponseComponetsSection from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar/ResponseComponetsSection";
import type {
  ComponentType,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const API_URL = "http://localhost:3000";

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const defaultSidebarProps = {
  selectedId: null,
  selectedIds: [],
  isResizingLeft: { current: false },
  leftPanelWidth: 280,
  setShowLeftPanel: vi.fn(),
  setLeftPanelWidth: vi.fn(),
  setSelectedIds: vi.fn(),
  CANVAS_WIDTH: 1000,
  CANVAS_HEIGHT: 600,
  toJsPsychCoords: vi.fn(() => ({ x: 12, y: -5 })),
  images: [],
  audios: [],
  videos: [],
  getDefaultConfig: vi.fn((type: ComponentType) => ({
    label: { source: "typed", value: type },
  })),
};

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

    const { result } = renderHook(() =>
      useComponentMetadata("ImageComponent"),
    );

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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockReturnValue(lateError.promise);

    const { unmount } = renderHook(() => useComponentMetadata("ImageComponent"));

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
    expect(thumbnail).toHaveAttribute(
      "src",
      `${API_URL}/uploads/img/cat.png`,
    );

    const dataTransfer = { setData: vi.fn() };
    fireEvent.dragStart(thumbnail.parentElement as HTMLElement, {
      dataTransfer,
    });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "fileUrl",
      "uploads/img/cat.png",
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "type",
      "ImageComponent",
    );

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
    const { rerender } = render(
      <ComponentSidebar {...props} isOpen={false} />,
    );

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

  it("adds new sidebar components with unique names, coordinates and z-index", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);

    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "existing-text",
          type: "TextComponent",
          x: 10,
          y: 10,
          width: 0,
          height: 0,
          zIndex: 4,
          config: {
            name: { source: "typed", value: "TextComponent_1" },
          },
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(null);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            components={components}
            setComponents={setComponents}
          />
          <pre data-testid="state">
            {JSON.stringify({ components, selectedId })}
          </pre>
        </>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByText("Text"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(state.selectedId).toBe("TextComponent-12345");
    expect(state.components[1]).toEqual({
      id: "TextComponent-12345",
      type: "TextComponent",
      x: 500,
      y: 300,
      width: 0,
      height: 0,
      zIndex: 5,
      config: {
        label: { source: "typed", value: "TextComponent" },
        name: { source: "typed", value: "TextComponent_2" },
        coordinates: { source: "typed", value: { x: 12, y: -5 } },
        zIndex: { source: "typed", value: 5 },
      },
    });
  });

  it("renders ComponentsSection media empty states and drag payloads", () => {
    const { rerender } = render(
      <ComponentsSection
        type="ImageComponent"
        label="Image"
        images={[]}
        videos={[]}
        audios={[]}
        addComponent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Image"));
    expect(screen.getByText("No images")).toBeInTheDocument();

    rerender(
      <ComponentsSection
        type="VideoComponent"
        label="Video"
        images={[]}
        videos={["uploads/vid/clip.mp4"]}
        audios={[]}
        addComponent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Video"));
    const videoPayload = { setData: vi.fn() };
    fireEvent.dragStart(screen.getByText("clip.mp4").parentElement as HTMLElement, {
      dataTransfer: videoPayload,
    });
    expect(videoPayload.setData).toHaveBeenCalledWith(
      "fileUrl",
      "uploads/vid/clip.mp4",
    );
    expect(videoPayload.setData).toHaveBeenCalledWith(
      "type",
      "VideoComponent",
    );

    rerender(
      <ComponentsSection
        type="AudioComponent"
        label="Audio"
        images={[]}
        videos={[]}
        audios={["uploads/aud/tone.mp3"]}
        addComponent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Audio/ }));
    const audioPayload = { setData: vi.fn() };
    fireEvent.dragStart(screen.getByText("tone.mp3").parentElement as HTMLElement, {
      dataTransfer: audioPayload,
    });
    expect(audioPayload.setData).toHaveBeenCalledWith(
      "fileUrl",
      "uploads/aud/tone.mp3",
    );
    expect(audioPayload.setData).toHaveBeenCalledWith(
      "type",
      "AudioComponent",
    );

    rerender(
      <ComponentsSection
        type="AudioComponent"
        label="Audio"
        images={[]}
        videos={[]}
        audios={[]}
        addComponent={vi.fn()}
      />,
    );

    expect(screen.getByText("No audio")).toBeInTheDocument();
  });

  it("delegates generic ComponentsSection entries to addComponent with hover states", () => {
    const addComponent = vi.fn();

    render(
      <ComponentsSection
        type="HtmlComponent"
        label="HTML"
        images={[]}
        videos={[]}
        audios={[]}
        addComponent={addComponent}
      />,
    );

    const button = screen.getByText("HTML");
    fireEvent.mouseOver(button);
    expect(button).toHaveStyle({
      background: "#f3f4f6",
      borderColor: "#9ca3af",
    });
    fireEvent.mouseOut(button);
    expect(button).toHaveStyle({
      background: "white",
      borderColor: "#d1d5db",
    });
    fireEvent.click(button);

    expect(addComponent).toHaveBeenCalledWith("HtmlComponent");
  });

  it("filters and toggles response component entries", () => {
    const addComponent = vi.fn();

    render(
      <ResponseComponetsSection
        componentTypes={[
          { type: "TextComponent", label: "Text" },
          { type: "ButtonResponseComponent", label: "Button response" },
          { type: "SliderResponseComponent", label: "Slider response" },
        ]}
        addComponent={addComponent}
      />,
    );

    expect(screen.queryByText("Text")).not.toBeInTheDocument();
    expect(screen.getByText("Button response")).toBeInTheDocument();
    expect(screen.getByText("Slider response")).toBeInTheDocument();

    const responseButton = screen.getByText("Button response");
    fireEvent.mouseOver(responseButton);
    expect(responseButton).toHaveStyle({
      background: "#f3f4f6",
      borderColor: "#9ca3af",
    });
    fireEvent.mouseOut(responseButton);
    expect(responseButton).toHaveStyle({
      background: "white",
      borderColor: "#d1d5db",
    });
    fireEvent.click(responseButton);
    expect(addComponent).toHaveBeenCalledWith("ButtonResponseComponent");

    fireEvent.click(screen.getByRole("button", { name: /Response/ }));
    expect(screen.queryByText("Button response")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Response/ }));
    expect(screen.getByText("Button response")).toBeInTheDocument();
  });

  it("deletes the selected sidebar component", () => {
    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "selected-button",
          type: "ButtonResponseComponent",
          x: 10,
          y: 10,
          width: 0,
          height: 0,
          config: {},
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(
        "selected-button",
      );
      const [selectedIds, setSelectedIds] = useState<string[]>([]);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            selectedIds={selectedIds}
            setSelectedId={setSelectedId}
            setSelectedIds={setSelectedIds}
            components={components}
            setComponents={setComponents}
          />
          <pre data-testid="state">
            {JSON.stringify({ components, selectedId })}
          </pre>
        </>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByText("Delete Selected"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(state).toEqual({ components: [], selectedId: null });
  });

  it("resizes, hides and restores the left sidebar handle state", () => {
    const isResizingLeft = { current: false };
    const setShowLeftPanel = vi.fn();
    const setLeftPanelWidth = vi.fn();

    const { container } = render(
      <LeftSideBar
        {...defaultSidebarProps}
        isResizingLeft={isResizingLeft}
        setShowLeftPanel={setShowLeftPanel}
        setLeftPanelWidth={setLeftPanelWidth}
        selectedId={null}
        setSelectedId={vi.fn()}
        components={[]}
        setComponents={vi.fn()}
      />,
    );

    const resizeHandle = container.querySelector<HTMLElement>(
      'div[style*="col-resize"]',
    )!;
    fireEvent.mouseOver(resizeHandle);
    expect(resizeHandle).toHaveStyle({ background: "#000" });
    fireEvent.mouseOut(resizeHandle);
    expect(resizeHandle.style.background).toBe("transparent");

    fireEvent.mouseDown(resizeHandle);
    expect(isResizingLeft.current).toBe(true);

    fireEvent.mouseMove(document, { clientX: 360 });
    expect(setLeftPanelWidth).toHaveBeenCalledWith(340);
    expect(setShowLeftPanel).toHaveBeenCalledWith(true);

    fireEvent.mouseMove(document, { clientX: 120 });
    expect(setShowLeftPanel).toHaveBeenCalledWith(false);

    fireEvent.mouseUp(document);
    expect(isResizingLeft.current).toBe(false);

    fireEvent.mouseMove(document, { clientX: 500 });
    expect(setLeftPanelWidth).toHaveBeenCalledTimes(1);
  });

  it("adds sidebar component types with their expected default dimensions", () => {
    let now = 2000;
    vi.spyOn(Date, "now").mockImplementation(() => now++);

    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        {
          id: "existing",
          type: "TextComponent",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          zIndex: 2,
          config: {},
        },
        {
          id: "existing-without-z-index",
          type: "AudioComponent",
          x: 0,
          y: 0,
          width: 200,
          height: 50,
          config: {},
        },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(null);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            components={components}
            setComponents={setComponents}
          />
          <pre data-testid="state">
            {JSON.stringify({ components, selectedId })}
          </pre>
        </>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /Stimulus/ }));
    expect(screen.queryByText("Image")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stimulus/ }));

    for (const label of [
      "Slider",
      "Sketchpad",
      "Survey",
      "File Upload",
      "Button",
      "Text",
      "HTML",
      "Input",
    ]) {
      fireEvent.click(screen.getByText(label));
    }

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    const byType = Object.fromEntries(
      state.components.map((component: TrialComponent) => [
        component.type,
        component,
      ]),
    );

    expect(byType.SliderResponseComponent).toMatchObject({
      width: 250,
      height: 100,
    });
    expect(byType.InputResponseComponent).toMatchObject({
      width: 200,
      height: 50,
    });
    for (const type of [
      "SketchpadComponent",
      "SurveyComponent",
      "FileUploadResponseComponent",
      "ButtonResponseComponent",
      "TextComponent",
      "HtmlComponent",
    ]) {
      expect(byType[type]).toMatchObject({ width: 0, height: 0 });
    }
    expect(state.selectedId).toMatch(/^InputResponseComponent-/);
    expect(byType.InputResponseComponent.config.zIndex.value).toBe(10);
  });

  it("deletes all selected sidebar components when multi-selection is active", () => {
    function Harness() {
      const [components, setComponents] = useState<TrialComponent[]>([
        { id: "a", type: "TextComponent", x: 0, y: 0, width: 0, height: 0, config: {} },
        { id: "b", type: "TextComponent", x: 0, y: 0, width: 0, height: 0, config: {} },
        { id: "c", type: "TextComponent", x: 0, y: 0, width: 0, height: 0, config: {} },
      ]);
      const [selectedId, setSelectedId] = useState<string | null>(null);
      const [selectedIds, setSelectedIds] = useState<string[]>(["a", "c"]);

      return (
        <>
          <LeftSideBar
            {...defaultSidebarProps}
            selectedId={selectedId}
            selectedIds={selectedIds}
            setSelectedId={setSelectedId}
            setSelectedIds={setSelectedIds}
            components={components}
            setComponents={setComponents}
          />
          <pre data-testid="state">
            {JSON.stringify({ components, selectedId, selectedIds })}
          </pre>
        </>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByText("Delete Selected"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(state.components.map((component: TrialComponent) => component.id)).toEqual([
      "b",
    ]);
    expect(state.selectedId).toBeNull();
    expect(state.selectedIds).toEqual([]);
  });
});
