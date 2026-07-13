import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handleDrop from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleDrop";
import type {
  ComponentType,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function createDropEvent(clientX = 180, clientY = 260) {
  return {
    preventDefault: vi.fn(),
    clientX,
    clientY,
  } as unknown as React.DragEvent;
}

function createStageRef(left = 30, top = 40) {
  return {
    current: {
      container: () => ({
        getBoundingClientRect: () => ({
          left,
          top,
        }),
      }),
    },
  } as any;
}

function createSetComponents(initial: TrialComponent[]) {
  let current = initial;
  const setComponents = vi.fn((update: React.SetStateAction<TrialComponent[]>) => {
    current = typeof update === "function" ? update(current) : update;
  });

  return {
    setComponents,
    getComponents: () => current,
  };
}

const existingComponents: TrialComponent[] = [
  {
    id: "ImageComponent-existing",
    type: "ImageComponent",
    x: 10,
    y: 20,
    width: 0,
    height: 0,
    zIndex: 4,
    config: {
      name: { source: "typed", value: "ImageComponent_1" },
    },
  },
];

function dropComponent(
  type: ComponentType,
  overrides: Partial<Parameters<typeof handleDrop>[0]> = {},
) {
  const initialComponents = overrides.components ?? existingComponents;
  const state = createSetComponents(initialComponents);
  const onAutoSave = vi.fn();
  const generateConfigFromComponents = vi.fn(() => ({ mapped: true }));
  const setSelectedId = vi.fn();
  const getDefaultConfig = vi.fn((componentType: ComponentType) => ({
    default_param: { source: "typed", value: componentType },
  }));

  handleDrop({
    e: createDropEvent(),
    fileUrl: "uploads/img/cat.png",
    type,
    stageRef: createStageRef(),
    components: initialComponents,
    toJsPsychCoords: vi.fn(() => ({ x: -25, y: 30 })),
    getDefaultConfig,
    setComponents: state.setComponents,
    onAutoSave,
    generateConfigFromComponents,
    setSelectedId,
    ...overrides,
  });

  return {
    ...state,
    onAutoSave,
    generateConfigFromComponents,
    setSelectedId,
    getDefaultConfig,
  };
}

describe("TrialDesigner handleDrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(12345);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("adds dropped image components with unique name, coordinates, z-index and autosave", () => {
    const result = dropComponent("ImageComponent");

    expect(result.getComponents()).toEqual([
      existingComponents[0],
      {
        id: "ImageComponent-12345",
        type: "ImageComponent",
        x: 150,
        y: 220,
        width: 0,
        height: 0,
        zIndex: 5,
        config: {
          default_param: { source: "typed", value: "ImageComponent" },
          name: { source: "typed", value: "ImageComponent_2" },
          coordinates: { source: "typed", value: { x: -25, y: 30 } },
          zIndex: { source: "typed", value: 5 },
          stimulus: { source: "typed", value: "uploads/img/cat.png" },
        },
      },
    ]);
    expect(result.setSelectedId).toHaveBeenCalledWith("ImageComponent-12345");
    expect(result.generateConfigFromComponents).toHaveBeenCalledWith(
      result.getComponents(),
    );

    vi.advanceTimersByTime(100);

    expect(result.onAutoSave).toHaveBeenCalledWith({ mapped: true });
  });

  it("stores video stimuli as arrays and audio stimuli as strings", () => {
    const video = dropComponent("VideoComponent");
    expect(video.getComponents()[1].config.stimulus).toEqual({
      source: "typed",
      value: ["uploads/img/cat.png"],
    });

    const audio = dropComponent("AudioComponent");
    expect(audio.getComponents()[1].config.stimulus).toEqual({
      source: "typed",
      value: "uploads/img/cat.png",
    });
  });

  it("does not update state when the stage is not available", () => {
    const state = createSetComponents(existingComponents);
    const event = createDropEvent();
    const onAutoSave = vi.fn();

    handleDrop({
      e: event,
      fileUrl: "uploads/img/cat.png",
      type: "ImageComponent",
      stageRef: { current: null },
      components: existingComponents,
      toJsPsychCoords: vi.fn(),
      getDefaultConfig: vi.fn(),
      setComponents: state.setComponents,
      onAutoSave,
      generateConfigFromComponents: vi.fn(),
      setSelectedId: vi.fn(),
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(state.setComponents).not.toHaveBeenCalled();
    expect(onAutoSave).not.toHaveBeenCalled();
    expect(state.getComponents()).toEqual(existingComponents);
  });

  it("defaults missing z-indexes and skips autosave when it is disabled", () => {
    const componentWithoutZIndex = {
      ...existingComponents[0],
      zIndex: undefined,
    } as TrialComponent;
    const result = dropComponent("HtmlComponent", {
      components: [componentWithoutZIndex],
      onAutoSave: undefined,
    });

    expect(result.getComponents()[1]).toMatchObject({
      type: "HtmlComponent",
      zIndex: 1,
      config: {
        zIndex: { source: "typed", value: 1 },
      },
    });
    expect(result.generateConfigFromComponents).not.toHaveBeenCalled();
  });
});
