import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock("konva", () => ({ default: {} }));

vi.mock("react-konva", () => ({
  Rect: (props: any) => (
    <div data-testid={`rect-${props.id}`} data-stroke={props.stroke}>
      <button onClick={props.onClick}>select rect</button>
      <button
        onClick={() =>
          props.onDragEnd?.({
            target: {
              x: () => 66,
              y: () => 77,
            },
          })
        }
      >
        drag rect
      </button>
    </div>
  ),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel",
  () => ({
    isHtmlSceneComponent: (type: string) => type === "HtmlComponent",
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/EditorHitBox",
  () => ({
    default: ({
      shapeProps,
      onSelect,
      onChange,
      onActivateDom,
      onEditText,
    }: any) => (
      <button
        data-testid={`hitbox-${shapeProps.id}`}
        onClick={() => {
          onSelect();
          onActivateDom();
          onEditText();
          onChange({ x: 40, y: 50, __transient: true });
        }}
      >
        hitbox
      </button>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents",
  () => {
    const visual =
      (name: string) =>
      ({ shapeProps, onSelect, onChange, onEditStart }: any) => (
        <button
          data-testid={`visual-${name}-${shapeProps.id}`}
          onClick={() => {
            onSelect();
            onEditStart?.();
            if (shapeProps.id.includes("only-x")) {
              onChange({ x: 310 });
              return;
            }
            if (shapeProps.id.includes("only-y")) {
              onChange({ y: 410 });
              return;
            }
            if (shapeProps.id.includes("size-only")) {
              onChange({ width: 260 });
              return;
            }
            onChange({
              x: 210,
              y: 190,
              width: 320,
              height: 120,
              rotation: 12,
              zIndex: 7,
              textFontSize: 24,
              inputFontSize: 19,
              buttonFontSize: 18,
            });
          }}
        >
          {name}
        </button>
      );

    return {
      ImageComponent: visual("ImageComponent"),
      VideoComponent: visual("VideoComponent"),
      AudioComponent: visual("AudioComponent"),
      TextComponent: visual("TextComponent"),
      ButtonResponseComponent: visual("ButtonResponseComponent"),
      KeyboardResponseComponent: visual("KeyboardResponseComponent"),
      SliderResponseComponent: visual("SliderResponseComponent"),
      InputResponseComponent: visual("InputResponseComponent"),
      SketchpadComponent: visual("SketchpadComponent"),
      AudioResponseComponent: visual("AudioResponseComponent"),
      FileUploadResponseComponent: visual("FileUploadResponseComponent"),
      ClickResponseComponent: visual("ClickResponseComponent"),
    };
  },
);

import renderComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent";

function component(
  type: TrialComponent["type"] | "HtmlComponent" | "UnknownComponent",
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-id`,
    type: type as TrialComponent["type"],
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    zIndex: 1,
    config: {},
    ...overrides,
  };
}

function Harness({
  initial,
  selectedId = null,
  selectedIds = [],
  withCanvasStyles = false,
  withAutoSave = true,
}: {
  initial: TrialComponent;
  selectedId?: string | null;
  selectedIds?: string[];
  withCanvasStyles?: boolean;
  withAutoSave?: boolean;
}) {
  const [components, setComponents] = useState([
    initial,
    component("AudioComponent", { id: "untouched" }),
  ]);
  const [selected, setSelected] = useState<string | null>(selectedId);
  const [activeDomId, setActiveDomId] = useState<string | null>(null);
  const [editTextId, setEditTextId] = useState<string | null>(null);
  const [saved, setSaved] = useState("none");
  const [historyCount, setHistoryCount] = useState(0);

  const node = renderComponent({
    comp: components[0],
    components,
    setComponents,
    selectedId: selected,
    selectedIds,
    setSelectedId: setSelected,
    toJsPsychCoords: (x, y) => ({ x: x + 1, y: y + 2 }),
    onAutoSave: withAutoSave ? (config) => setSaved(JSON.stringify(config)) : undefined,
    generateConfigFromComponents: (next) => ({ ids: next.map((item) => item.id) }),
    uploadedFiles: [{ name: "asset.png", url: "/asset.png" }],
    canvasStyles: withCanvasStyles
      ? {
          width: 500,
          height: 400,
          fullScreen: false,
          progressBar: false,
          backgroundColor: "#fff",
        }
      : undefined,
    htmlSceneMetrics: {
      [initial.id]: { width: 70, height: 30 },
    },
    setActiveDomId,
    editingTextId: editTextId,
    onEditTextStart: setEditTextId,
    onRecordHistory: () => setHistoryCount((count) => count + 1),
  });

  return (
    <div>
      {node}
      <output data-testid="state">{JSON.stringify(components[0])}</output>
      <output data-testid="selected">{selected ?? "none"}</output>
      <output data-testid="active">{activeDomId ?? "none"}</output>
      <output data-testid="editing">{editTextId ?? "none"}</output>
      <output data-testid="saved">{saved}</output>
      <output data-testid="history">{historyCount}</output>
    </div>
  );
}

describe("renderComponent switch coverage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    "ImageComponent",
    "ButtonResponseComponent",
    "VideoComponent",
    "AudioComponent",
    "KeyboardResponseComponent",
    "SliderResponseComponent",
    "InputResponseComponent",
    "SketchpadComponent",
    "AudioResponseComponent",
    "FileUploadResponseComponent",
    "ClickResponseComponent",
  ] as const)("renders and updates %s through its visual component", async (type) => {
    render(
      <Harness
        initial={component(type, { id: `${type}-case` })}
        selectedIds={[`${type}-case`]}
        withCanvasStyles={type === "ImageComponent"}
      />,
    );

    fireEvent.click(screen.getByTestId(`visual-${type}-${type}-case`));

    await waitFor(() => {
      expect(screen.getByTestId("selected")).toHaveTextContent(`${type}-case`);
      expect(screen.getByTestId("state")).toHaveTextContent('"coordinates"');
      expect(screen.getByTestId("state")).toHaveTextContent('"rotation"');
      expect(screen.getByTestId("saved")).toHaveTextContent(`${type}-case`);
    });
  });

  it("routes selected text components through the editable text visual component", async () => {
    render(
      <Harness
        initial={component("TextComponent", { id: "text-selected" })}
        selectedId="text-selected"
      />,
    );

    fireEvent.click(screen.getByTestId("visual-TextComponent-text-selected"));

    await waitFor(() => {
      expect(screen.getByTestId("editing")).toHaveTextContent("text-selected");
      expect(screen.getByTestId("state")).toHaveTextContent('"font_size"');
    });
  });

  it("routes html scene components through EditorHitBox callbacks without autosave for transient changes", async () => {
    render(
      <Harness
        initial={component("HtmlComponent", { id: "html-scene" })}
        withAutoSave={false}
      />,
    );

    fireEvent.click(screen.getByTestId("hitbox-html-scene"));

    await waitFor(() => {
      expect(screen.getByTestId("selected")).toHaveTextContent("html-scene");
      expect(screen.getByTestId("active")).toHaveTextContent("html-scene");
      expect(screen.getByTestId("editing")).toHaveTextContent("html-scene");
      expect(screen.getByTestId("state")).not.toHaveTextContent('"coordinates"');
      expect(screen.getByTestId("history")).toHaveTextContent("0");
      expect(screen.getByTestId("saved")).toHaveTextContent("none");
    });
  });

  it("updates default rectangles on select and drag", async () => {
    render(
      <Harness
        initial={component("UnknownComponent", {
          id: "unknown-rect",
          width: 40,
          height: 20,
        })}
        selectedId="unknown-rect"
      />,
    );

    expect(screen.getByTestId("rect-unknown-rect")).toHaveAttribute(
      "data-stroke",
      "#374151",
    );
    fireEvent.click(screen.getByText("select rect"));
    fireEvent.click(screen.getByText("drag rect"));

    await waitFor(() => {
      expect(screen.getByTestId("selected")).toHaveTextContent("unknown-rect");
      expect(screen.getByTestId("state")).toHaveTextContent('"coordinates"');
      expect(screen.getByTestId("history")).toHaveTextContent("1");
      expect(screen.getByTestId("saved")).toHaveTextContent("unknown-rect");
    });
  });

  it("handles coordinate updates with partial and absent coordinates", async () => {
    const { rerender } = render(
      <Harness
        key="only-x"
        initial={component("AudioComponent", { id: "audio-only-x" })}
      />,
    );
    fireEvent.click(screen.getByTestId("visual-AudioComponent-audio-only-x"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"x":310');
      expect(screen.getByTestId("state")).toHaveTextContent('"y":22');
    });

    rerender(
      <Harness
        key="only-y"
        initial={component("AudioComponent", { id: "audio-only-y" })}
      />,
    );
    fireEvent.click(screen.getByTestId("visual-AudioComponent-audio-only-y"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"x":11');
      expect(screen.getByTestId("state")).toHaveTextContent('"y":410');
    });

    rerender(
      <Harness
        key="size-only"
        initial={component("AudioComponent", { id: "audio-size-only" })}
      />,
    );
    fireEvent.click(screen.getByTestId("visual-AudioComponent-audio-size-only"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"width"');
      expect(screen.getByTestId("state")).not.toHaveTextContent('"coordinates"');
    });
  });

  it("covers default rectangle branches without autosave and unselected text", async () => {
    const { rerender } = render(
      <Harness
        key="rect-no-save"
        initial={component("UnknownComponent", { id: "rect-no-save" })}
        withAutoSave={false}
      />,
    );

    fireEvent.click(screen.getByText("drag rect"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"coordinates"');
      expect(screen.getByTestId("saved")).toHaveTextContent("none");
    });

    rerender(
      <Harness
        key="text-not-selected"
        initial={component("TextComponent", { id: "text-not-selected" })}
        withAutoSave={false}
      />,
    );

    expect(screen.getByTestId("rect-text-not-selected")).toBeInTheDocument();
  });
});
