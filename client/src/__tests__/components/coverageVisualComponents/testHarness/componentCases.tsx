import { vi } from "vitest";
import AudioComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/AudioComponent";
import AudioResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/AudioResponseComponent";
import ButtonResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ButtonResponseComponent";
import ClickResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ClickResponseComponent";
import FileUploadResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/FileUploadResponseComponent";
import ImageComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ImageComponent";
import InputResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/InputResponseComponent";
import KeyboardResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/KeyboardResponseComponent";
import SketchpadComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/SketchpadComponent";
import SliderResponseComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/SliderResponseComponent";
import TextComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/TextComponent";
import VideoComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/VideoComponent";
import { TrialComponent } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function value(value: unknown) {
  return { source: "typed", value };
}

function shape(
  type: TrialComponent["type"],
  config: Record<string, unknown> = {},
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-id`,
    type,
    x: 100,
    y: 120,
    width: 160,
    height: 80,
    rotation: 4,
    config,
    ...overrides,
  };
}

const componentCases = [
  {
    name: "TextComponent",
    Component: TextComponent,
    props: {
      shapeProps: shape("TextComponent", {
        text: value("Prompt %answer% here"),
        font_size: value(18),
        line_height: value(1.4),
        background_color: value("#ffffff"),
        border_width: value(1),
        border_color: value("#222222"),
        padding: value("4px 8px"),
      }),
      canvasWidth: 800,
      isEditing: false,
      onEditStart: vi.fn(),
    },
  },
  {
    name: "ImageComponent",
    Component: ImageComponent,
    props: {
      shapeProps: shape(
        "ImageComponent",
        { stimulus: value("stim.png") },
        { width: 0, height: 0 },
      ),
      uploadedFiles: [{ name: "stim.png", path: "stim.png" }],
    },
  },
  {
    name: "VideoComponent",
    Component: VideoComponent,
    props: {
      shapeProps: shape("VideoComponent", {
        stimulus: value(["clip.mp4"]),
      }),
      uploadedFiles: [{ name: "clip.mp4", path: "clip.mp4" }],
    },
  },
  {
    name: "AudioComponent",
    Component: AudioComponent,
    props: { shapeProps: shape("AudioComponent") },
  },
  {
    name: "ButtonResponseComponent",
    Component: ButtonResponseComponent,
    props: {
      shapeProps: shape(
        "ButtonResponseComponent",
        {
          choices: value(["Yes", "No,Maybe", "icon.png"]),
          grid_rows: value(2),
          button_font_size: value(16),
          button_color: value("#eeeeee"),
          button_border_width: value(2),
        },
        { buttonFontSize: 16 },
      ),
    },
  },
  {
    name: "KeyboardResponseComponent",
    Component: KeyboardResponseComponent,
    props: {
      shapeProps: shape("KeyboardResponseComponent", {
        choices: value("ALL_KEYS"),
        prompt: value("Press a key"),
      }),
    },
  },
  {
    name: "SliderResponseComponent",
    Component: SliderResponseComponent,
    props: {
      shapeProps: shape("SliderResponseComponent", {
        min: value(0),
        max: value(100),
        slider_start: value(45),
        labels: value(["Low", "High"]),
        require_movement: value(true),
      }),
    },
  },
  {
    name: "InputResponseComponent",
    Component: InputResponseComponent,
    props: {
      shapeProps: shape(
        "InputResponseComponent",
        {
          text: value("Answer: %answer%"),
          input_type: value("datetime-local"),
          placeholder: value("date"),
          input_font_size: value(18),
        },
        { inputFontSize: 18, inputWidth: 180 },
      ),
    },
  },
  {
    name: "SketchpadComponent",
    Component: SketchpadComponent,
    props: {
      shapeProps: shape("SketchpadComponent", {
        canvas_shape: value("circle"),
        canvas_diameter: value(160),
        stroke_color: value("#ff0000"),
        show_clear_button: value(true),
        show_undo_button: value(true),
      }),
    },
  },
  {
    name: "AudioResponseComponent",
    Component: AudioResponseComponent,
    props: {
      shapeProps: shape("AudioResponseComponent", {
        prompt: value("Speak now"),
        recording_duration: value(3000),
      }),
    },
  },
  {
    name: "FileUploadResponseComponent",
    Component: FileUploadResponseComponent,
    props: {
      shapeProps: shape("FileUploadResponseComponent", {
        button_label: value("Upload"),
        accept: value("pdf,csv"),
        multiple: value(true),
        show_preview: value(true),
      }),
    },
  },
  {
    name: "ClickResponseComponent",
    Component: ClickResponseComponent,
    props: {
      shapeProps: shape("ClickResponseComponent", {
        capture_full_screen: value(false),
        show_click_marker: value(true),
        marker_color: value("#ff00ff"),
        marker_radius: value(12),
      }),
    },
  },
];

export {
  AudioComponent,
  AudioResponseComponent,
  ButtonResponseComponent,
  ClickResponseComponent,
  FileUploadResponseComponent,
  ImageComponent,
  InputResponseComponent,
  KeyboardResponseComponent,
  SketchpadComponent,
  SliderResponseComponent,
  TextComponent,
  VideoComponent,
  componentCases,
  shape,
  value,
};
