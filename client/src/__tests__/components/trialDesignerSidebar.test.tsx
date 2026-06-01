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
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const defaultSidebarProps = {
  selectedId: null,
  isResizingLeft: { current: false },
  leftPanelWidth: 280,
  setShowLeftPanel: vi.fn(),
  setLeftPanelWidth: vi.fn(),
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

    fireEvent.click(screen.getByText("Delete Selected"));

    const state = JSON.parse(screen.getByTestId("state").textContent || "{}");
    expect(state).toEqual({ components: [], selectedId: null });
  });
});
