import { vi } from "vitest";

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar",
  () => ({
    default: ({
      components,
      setComponents,
      getDefaultConfig,
      setSelectedId,
      setSelectedIds,
      setShowLeftPanel,
      toJsPsychCoords,
    }: any) => (
      <div data-testid="component-sidebar">
        <div>sidebar components:{components.length}</div>
        <div>coords:{JSON.stringify(toJsPsychCoords(250, 200))}</div>
        <button
          onClick={() => {
            const next = {
              id: "button-a",
              type: "ButtonResponseComponent",
              x: 180,
              y: 140,
              width: 160,
              height: 48,
              config: getDefaultConfig("ButtonResponseComponent"),
            };
            setComponents((prev: any[]) => [...prev, next]);
            setSelectedId("button-a");
          }}
        >
          sidebar add component
        </button>
        <button onClick={() => setComponents(components)}>
          sidebar noop components
        </button>
        <button
          onClick={() =>
            setComponents([
              ...components,
              {
                id: "direct-keyboard",
                type: "KeyboardResponseComponent",
                x: 210,
                y: 180,
                width: 140,
                height: 42,
                config: getDefaultConfig("KeyboardResponseComponent"),
              },
            ])
          }
        >
          sidebar direct set
        </button>
        <button
          onClick={() => {
            const componentTypes = [
              "ButtonResponseComponent",
              "TextComponent",
              "HtmlComponent",
              "ImageComponent",
              "SliderResponseComponent",
              "KeyboardResponseComponent",
              "InputResponseComponent",
              "FileUploadResponseComponent",
              "AudioComponent",
              "VideoComponent",
              "SketchpadComponent",
              "SurveyComponent",
              "ClickResponseComponent",
              "UnknownComponent",
            ];

            setComponents(
              componentTypes.map((type, index) => ({
                id: `default-${type}`,
                type,
                x: 40 + index,
                y: 80 + index,
                width: 0,
                height: 0,
                config: getDefaultConfig(type),
              })),
            );
            setSelectedIds(["default-ButtonResponseComponent"]);
          }}
        >
          sidebar load defaults
        </button>
        <button
          onClick={() => setSelectedIds(components.map((c: any) => c.id))}
        >
          sidebar select all
        </button>
        <button onClick={() => setSelectedIds(["missing-id"])}>
          sidebar select ghost
        </button>
        <button onClick={() => setComponents([])}>
          sidebar clear components
        </button>
        <button onClick={() => setShowLeftPanel(false)}>
          sidebar hide left
        </button>
      </div>
    ),
  }),
);
