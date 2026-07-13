import { vi } from "vitest";
import { wrapperMocks } from "./state";

vi.mock("konva", () => ({ default: {} }));

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/Modal",
  () => ({
    default: ({ isOpen, children }: any) =>
      isOpen ? <div data-testid="designer-modal">{children}</div> : null,
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () => ({
      loading: false,
      metadata: {
        parameters: {
          text: { pretty_name: "Text", type: "string" },
        },
      },
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents",
  () => ({
    default: () => (components: any[]) => ({
      componentCount: components.length,
      ids: components.map((component) => component.id),
    }),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent",
  () => ({
    default: wrapperMocks.renderComponent,
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useLoadComponents",
  async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
      default: ({ isOpen, setComponents, setSelectedId }: any) => {
        React.useEffect(() => {
          if (!isOpen) return;
          const loadedComponents = wrapperMocks.initialComponents ?? [
            {
              id: "text-a",
              type: "TextComponent",
              x: 100,
              y: 100,
              width: 120,
              height: 40,
              config: {
                text: { source: "typed", value: "Loaded text" },
                coordinates: { source: "typed", value: { x: 0, y: 0 } },
              },
            },
          ];
          setComponents(loadedComponents);
          setSelectedId(
            wrapperMocks.initialSelectedId !== undefined
              ? wrapperMocks.initialSelectedId
              : (loadedComponents[0]?.id ?? null),
          );
        }, [isOpen, setComponents, setSelectedId]);
      },
    };
  },
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleDrop",
  () => ({
    default: wrapperMocks.handleDrop,
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleResize",
  () => ({
    default: vi.fn(),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/hooks/useCanvasStyles",
  async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
      default: () => {
        const [canvasStyles, setCanvasStyles] = React.useState({
          backgroundColor: "#ffffff",
          width: 500,
          height: 400,
          fullScreen: false,
          progressBar: false,
        });
        return { canvasStyles, setCanvasStyles };
      },
    };
  },
);
