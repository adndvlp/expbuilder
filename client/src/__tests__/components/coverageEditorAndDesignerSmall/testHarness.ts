import { vi } from "vitest";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const hoistedEditorHarness = vi.hoisted(() => ({
  editorProps: undefined as any,
  editor: undefined as any,
  monaco: {
    KeyMod: { CtrlCmd: 1, Shift: 2 },
    KeyCode: { KeyZ: 4 },
    languages: {
      typescript: {
        ScriptTarget: { ESNext: "ESNext" },
        javascriptDefaults: {
          setDiagnosticsOptions: vi.fn(),
          setCompilerOptions: vi.fn(),
          addExtraLib: vi.fn(),
        },
      },
    },
  } as any,
  modelChange: undefined as undefined | (() => void),
  setCode: vi.fn(),
  mediaListener: undefined as
    | undefined
    | ((event: { matches: boolean }) => void),
}));

vi.mock("@monaco-editor/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: (props: any) => {
      hoistedEditorHarness.editorProps = props;
      return React.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            props.onMount(
              hoistedEditorHarness.editor,
              hoistedEditorHarness.monaco,
            ),
        },
        `Editor ${props.theme}`,
      );
    },
  };
});

vi.mock("monaco-editor", () => hoistedEditorHarness.monaco);

vi.mock("../../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => ({
    code: "const start = true;",
    setCode: hoistedEditorHarness.setCode,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    plugins: [{ name: "plugin-html-keyboard-response" }],
  }),
}));

export function textComponent(
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: "text-1",
    type: "TextComponent",
    x: 120,
    y: 80,
    width: 160,
    height: 80,
    rotation: 15,
    zIndex: 1,
    config: {
      text: { source: "typed", value: "Hello" },
      font_size: { source: "typed", value: 20 },
      background_color: { source: "typed", value: "transparent" },
    },
    ...overrides,
  } as TrialComponent;
}

export const editorHarness = hoistedEditorHarness;
