import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useContext, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrialsContext from "../../pages/ExperimentBuilder/contexts/TrialsContext";
import ErrorBoundary from "../../pages/ExperimentBuilder/components/ErrorBoundary";
import TabContent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TabContent";
import ColumnParams from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride/ColumnParams";
import {
  getConfigValue,
  getHtmlSceneNode,
  getHtmlSceneNodes,
  isHtmlSceneComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner",
  () => ({
    default: ({ isOpen, isAutoSaving, onSave, onAutoSave, onClose }: any) =>
      isOpen ? (
        <div data-testid="mock-trial-designer">
          <span>autosaving:{String(isAutoSaving)}</span>
          <button type="button" onClick={() => onAutoSave({ auto: true })}>
            auto designer
          </button>
          <button type="button" onClick={() => onSave({ saved: true })}>
            save designer
          </button>
          <button type="button" onClick={onClose}>
            close designer
          </button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: ({ parameters, onSave }: any) => (
      <div data-testid="mock-parameter-mapper">
        {parameters.map((param: any) => param.key).join(",")}
        <button type="button" onClick={() => onSave("difficulty", "easy")}>
          save general
        </button>
      </div>
    ),
  }),
);

function TrialsContextProbe() {
  const ctx = useContext(TrialsContext);
  const [result, setResult] = useState("");

  return (
    <div>
      <div data-testid="context-state">
        {ctx.timeline.length}:{ctx.loopTimeline.length}:{String(ctx.activeLoopId)}:
        {String(ctx.isLoading)}
      </div>
      <button
        type="button"
        onClick={async () => {
          ctx.setSelectedTrial(null);
          ctx.setSelectedLoop(null);
          const values = [
            await ctx.createTrial({ name: "trial" } as any),
            await ctx.getTrial("trial"),
            await ctx.updateTrial("trial", {} as any),
            await ctx.updateTrialField("trial", "name", "new"),
            await ctx.deleteTrial("trial"),
            await ctx.createLoop({ name: "loop" } as any),
            await ctx.getLoop("loop"),
            await ctx.updateLoop("loop", {} as any),
            await ctx.updateLoopField("loop", "name", "new"),
            await ctx.deleteLoop("loop"),
            await ctx.updateTimeline([]),
            await ctx.getTimeline(),
            await ctx.getLoopTimeline("loop", true, true),
            ctx.clearLoopTimeline(),
            await ctx.deleteAllTrials(),
          ];
          setResult(JSON.stringify(values));
        }}
      >
        run defaults
      </button>
      <output>{result}</output>
    </div>
  );
}

function renderColumnParams(overrides: Record<string, unknown> = {}) {
  const condition = {
    id: 1,
    customParameters: {
      "components::survey::survey_json::q1": {
        source: "typed",
        value: "old",
      },
    },
  } as any;
  const props = {
    isTargetDynamic: true,
    fieldType: "components",
    componentIdx: "survey",
    propName: "survey_json",
    comp: {
      name: { source: "typed", value: "survey" },
      type: "SurveyComponent",
      survey_json: {
        source: "typed",
        value: {
          elements: [
            { name: "q1", title: "Question 1" },
            { name: "q2" },
          ],
        },
      },
    },
    questionName: "q1",
    paramValue: { source: "typed", value: "old" },
    setConditions: vi.fn(),
    conditions: [condition, { id: 2, customParameters: { keep: true } }],
    parametersArray: [
      {
        key: "survey_json",
        label: "Survey JSON",
        type: "object",
        default: {},
        description: undefined,
      },
      {
        key: "text",
        label: "Text",
        type: "string",
        default: "",
        description: undefined,
      },
    ],
    availableParams: [
      { key: "difficulty", label: "Difficulty" },
      { key: "duration", label: "Duration" },
      { key: "unlabeled" },
    ],
    condition,
    paramKey: "components::survey::survey_json::q1",
    compArr: [
      { name: { source: "typed", value: "survey" } },
      { name: "button" },
    ],
    getPropValue: (prop: any) =>
      prop && typeof prop === "object" && "value" in prop ? prop.value : prop,
    metadataLoading: false,
    hasSurveyJsonParam: true,
    ...overrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <ColumnParams {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );

  return props;
}

function component(
  type: TrialComponent["type"],
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-${Math.random()}`,
    type,
    x: 100,
    y: 80,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 0,
    config: {},
    ...overrides,
  } as TrialComponent;
}

const canvasStyles: CanvasStyles = {
  width: 600,
  height: 400,
  backgroundColor: "#fff",
  fullScreen: true,
  progressBar: false,
};

describe("coverage core branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes every default TrialsContext callback", async () => {
    render(<TrialsContextProbe />);

    expect(screen.getByTestId("context-state")).toHaveTextContent("0:0:null:false");
    await act(async () => {
      fireEvent.click(screen.getByText("run defaults"));
    });

    expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/\[\{},null,null,false,false,\{},null/)).toBeInTheDocument();
  });

  it("renders ErrorBoundary children and fallback after a thrown render", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function CrashingChild({ fail }: { fail: boolean }) {
      if (fail) throw new Error("boom");
      return <div>child ok</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <CrashingChild fail={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("child ok")).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <CrashingChild fail />
      </ErrorBoundary>,
    );

    expect(screen.getByText("⚠️ Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/Please reload the page/)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("updates dynamic ColumnParams field, component, property and survey question keys", () => {
    const props = renderColumnParams();
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, customParameters: {} }),
      ]),
      true,
    );

    fireEvent.change(selects[0], { target: { value: "response_components" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "response_components::::": { source: "none", value: null },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "button" } });
    fireEvent.change(selects[2], { target: { value: "text" } });
    fireEvent.change(selects[3], { target: { value: "q2" } });

    expect(props.setConditions).toHaveBeenCalledWith(expect.any(Array), true);
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "components::survey::survey_json::q2": {
              source: "none",
              value: null,
            },
          }),
        }),
      ]),
      true,
    );
  });

  it("renders disabled dynamic ColumnParams states and normal plugin parameter edits", () => {
    renderColumnParams({
      fieldType: "",
      componentIdx: "",
      propName: "",
      comp: null,
      metadataLoading: true,
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[1]).toBeDisabled();

    renderColumnParams({
      comp: {
        name: { source: "typed", value: "empty-survey" },
        type: "SurveyComponent",
      },
      componentIdx: "empty-survey",
    });
    expect(screen.getByRole("option", { name: "Select question" })).toBeInTheDocument();

    const normalCondition = {
      id: 3,
      customParameters: {
        difficulty: { source: "typed", value: "medium" },
      },
    } as any;
    const normalProps = renderColumnParams({
      isTargetDynamic: false,
      condition: normalCondition,
      conditions: [
        normalCondition,
        { id: 4, customParameters: { untouched: true } },
      ],
      paramKey: "difficulty",
      paramValue: { source: "typed", value: "medium" },
    });

    const normalSelect = screen.getAllByRole("combobox").at(-1)!;
    expect(screen.getByRole("option", { name: "unlabeled" })).toBeInTheDocument();
    fireEvent.change(normalSelect, { target: { value: "duration" } });
    expect(normalProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: {
            duration: { source: "typed", value: "medium" },
          },
        }),
      ]),
      true,
    );

    fireEvent.change(normalSelect, { target: { value: "" } });
    expect(normalProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ customParameters: {} }),
      ]),
      true,
    );
  });

  it("switches TabContent tabs, hover states and designer callbacks", () => {
    const saveField = vi.fn(async () => {});
    const saveColumnMapping = vi.fn(async () => {});
    const setColumnMapping = vi.fn();

    render(
      <TabContent
        pluginName="plugin-dynamic"
        parameters={[
          { key: "components", label: "Components", type: "array" },
          { key: "response_components", label: "Responses", type: "array" },
          { key: "difficulty", label: "Difficulty", type: "string" },
        ] as any}
        columnMapping={{}}
        csvColumns={["condition"]}
        uploadedFiles={[]}
        saveIndicator={false}
        savingField={null}
        saveColumnMapping={saveColumnMapping}
        setColumnMapping={setColumnMapping}
        saveField={saveField}
      />,
    );

    const componentsTab = screen.getByText("Components");
    const generalTab = screen.getByText("General Settings");
    fireEvent.mouseOver(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("");
    fireEvent.mouseOut(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("");
    fireEvent.mouseOver(generalTab);
    expect(generalTab.style.backgroundColor).toBe("rgba(61, 146, 180, 0.1)");
    fireEvent.mouseOut(generalTab);
    expect(generalTab.style.backgroundColor).toBe("transparent");

    const openDesigner = screen.getByText("Open Visual Designer");
    fireEvent.mouseOver(openDesigner);
    expect(openDesigner).toHaveStyle({ transform: "translateY(-2px)" });
    fireEvent.mouseOut(openDesigner);
    expect(openDesigner).toHaveStyle({ transform: "translateY(0)" });
    fireEvent.click(openDesigner);

    expect(screen.getByText("autosaving:false")).toBeInTheDocument();
    fireEvent.click(screen.getByText("auto designer"));
    expect(saveField).toHaveBeenCalledWith("columnMapping", { auto: true });
    fireEvent.click(screen.getByText("save designer"));
    expect(setColumnMapping).toHaveBeenCalledWith({ saved: true });
    expect(saveField).toHaveBeenCalledWith("columnMapping", { saved: true });
    fireEvent.click(openDesigner);
    fireEvent.click(screen.getByText("close designer"));
    expect(screen.queryByTestId("mock-trial-designer")).not.toBeInTheDocument();

    fireEvent.click(generalTab);
    expect(screen.getByTestId("mock-parameter-mapper")).toHaveTextContent("difficulty");
    fireEvent.mouseOver(generalTab);
    expect(generalTab.style.backgroundColor).toBe("");
    fireEvent.mouseOut(generalTab);
    expect(generalTab.style.backgroundColor).toBe("");
    fireEvent.mouseOver(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("rgba(61, 146, 180, 0.1)");
    fireEvent.mouseOut(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("transparent");
    fireEvent.click(screen.getByText("save general"));
    expect(saveColumnMapping).toHaveBeenCalledWith("difficulty", "easy");
    fireEvent.click(componentsTab);
    expect(screen.getByText("Open Visual Designer")).toBeInTheDocument();
  });

  it("passes autosaving state to the visual designer", () => {
    render(
      <TabContent
        pluginName="plugin-dynamic"
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        uploadedFiles={[]}
        saveIndicator
        savingField="columnMapping"
        saveColumnMapping={vi.fn(async () => {})}
        setColumnMapping={vi.fn()}
        saveField={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByText("Open Visual Designer"));

    expect(screen.getByText("autosaving:true")).toBeInTheDocument();
  });

  it("covers HTML scene model config values, fallback sizes, metrics and sorting", () => {
    expect(isHtmlSceneComponent("TextComponent")).toBe(true);
    expect(isHtmlSceneComponent("AudioComponent" as any)).toBe(false);
    expect(getConfigValue(component("TextComponent"), "missing", "fallback")).toBe(
      "fallback",
    );
    expect(
      getConfigValue(
        component("TextComponent", { config: { text: { source: "none" } } }),
        "text",
        "fallback",
      ),
    ).toBe("fallback");
    expect(
      getConfigValue(
        component("TextComponent", {
          config: { text: { source: "typed", value: "hello" } },
        }),
        "text",
        "fallback",
      ),
    ).toBe("hello");
    expect(
      getConfigValue(
        component("TextComponent", {
          config: { text: { source: "typed", value: null } },
        }),
        "text",
        "fallback",
      ),
    ).toBe("fallback");
    expect(
      getConfigValue(component("TextComponent", { config: { text: "raw" } }), "text", ""),
    ).toBe("raw");

    const configured = getHtmlSceneNode(
      component("TextComponent", {
        id: "configured",
        x: 300,
        y: 200,
        config: {
          width: { source: "typed", value: 50 },
          height: { source: "typed", value: 25 },
        },
      }),
      canvasStyles,
    )!;
    expect(configured).toMatchObject({
      left: 150,
      top: 125,
      width: 300,
      height: 150,
      rotation: 0,
      zIndex: 0,
    });

    expect(
      getHtmlSceneNode(component("AudioComponent" as any), canvasStyles),
    ).toBeNull();
    expect(
      getHtmlSceneNode(component("HtmlComponent", { id: "metric" }), canvasStyles, {
        metric: { width: 10, height: 20 },
      })!.width,
    ).toBe(10);
    expect(
      getHtmlSceneNode(component("HtmlComponent", { id: "fallback" }), canvasStyles),
    ).toMatchObject({ width: 120, height: 40 });

    expect(
      getHtmlSceneNode(
        component("TextComponent", { width: 220, height: 60 }),
        canvasStyles,
      ),
    ).toMatchObject({ width: 220, height: 60 });

    expect(
      getHtmlSceneNode(component("SurveyComponent"), canvasStyles)!.height,
    ).toBe(240);
    expect(
      getHtmlSceneNode(
        component("SketchpadComponent", {
          config: {
            canvas_shape: { source: "typed", value: "circle" },
            canvas_diameter: { source: "typed", value: 75 },
          },
        }),
        canvasStyles,
      ),
    ).toMatchObject({ width: 75, height: 115 });
    expect(
      getHtmlSceneNode(
        component("SketchpadComponent", {
          config: {
            canvas_width: { source: "typed", value: 180 },
            canvas_height: { source: "typed", value: 90 },
          },
        }),
        canvasStyles,
      ),
    ).toMatchObject({ width: 180, height: 130 });
    expect(
      getHtmlSceneNode(
        component("SliderResponseComponent", {
          config: { height: { source: "typed", value: 20 } },
        }),
        canvasStyles,
      ),
    ).toMatchObject({ width: 300, height: 120 });
    expect(
      getHtmlSceneNode(component("SliderResponseComponent"), canvasStyles),
    ).toMatchObject({ width: 300, height: 120 });
    expect(
      getHtmlSceneNode(
        component("InputResponseComponent", {
          inputFontSize: 20,
          inputWidth: 240,
        } as any),
        canvasStyles,
      ),
    ).toMatchObject({ width: 240, height: 30 });
    expect(
      getHtmlSceneNode(
        component("InputResponseComponent", {
          config: {
            width: { source: "typed", value: 50 },
            input_font_size: { source: "typed", value: 18 },
          },
        }),
        canvasStyles,
      ),
    ).toMatchObject({ width: 300, height: 27 });
    const computedInput = getHtmlSceneNode(
      component("InputResponseComponent", {
        config: { input_font_size: { source: "typed", value: 10 } },
      }),
      canvasStyles,
    )!;
    expect(computedInput.width).toBeCloseTo(55);
    expect(computedInput.height).toBe(15);
    expect(getHtmlSceneNode(component("ButtonResponseComponent"), canvasStyles)).toMatchObject({
      width: 80,
      height: 34,
    });
    expect(getHtmlSceneNode(component("ImageComponent"), canvasStyles)).toMatchObject({
      width: 1,
      height: 1,
    });
    expect(
      getHtmlSceneNode(component("FileUploadResponseComponent"), canvasStyles),
    ).toMatchObject({ width: 120, height: 40 });
    expect(
      getHtmlSceneNode(
        component("TextComponent", { id: "no-z", zIndex: undefined }),
        canvasStyles,
      )!.zIndex,
    ).toBe(0);

    const sorted = getHtmlSceneNodes(
      [
        component("TextComponent", { id: "high", zIndex: 10 }),
        component("TextComponent", { id: "low", zIndex: 1 }),
        component("AudioComponent" as any, { id: "ignored" }),
      ],
      canvasStyles,
    );
    expect(sorted.map((node) => node.id)).toEqual(["low", "high"]);
  });
});
