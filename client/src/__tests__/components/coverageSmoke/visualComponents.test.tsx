import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AudioComponent,
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
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents";
import AudioResponseComponent from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/AudioResponseComponent";
import { nodeLike, visualProps } from "./visualFixtures";

vi.mock("use-image", () => ({
  default: () => [{ width: 160, height: 90 }],
}));

describe("coverage smoke: visual trial components", () => {
  it("renders core visual component functions without crashing", () => {
    const onChange = vi.fn();
    const shared = {
      ...visualProps("ButtonResponseComponent", {
        choices: { source: "typed", value: "Yes, No" },
        button_color: { source: "typed", value: "#123456" },
      }),
      onChange,
    };

    render(<ButtonResponseComponent {...shared} />);
    render(
      <ImageComponent
        {...visualProps("ImageComponent", {
          stimulus: { source: "typed", value: "image.png" },
        })}
      />,
    );
    render(<VideoComponent {...visualProps("VideoComponent")} />);
    render(<AudioComponent {...visualProps("AudioComponent")} />);
    render(
      <TextComponent
        {...visualProps("TextComponent", {
          text: { source: "typed", value: "Hello" },
          font_size: { source: "typed", value: 20 },
        })}
        isEditing={false}
        onEditStart={vi.fn()}
      />,
    );
    render(
      <InputResponseComponent {...visualProps("InputResponseComponent")} />,
    );
    render(
      <SliderResponseComponent
        {...visualProps("SliderResponseComponent", {
          labels: { source: "typed", value: ["Low", "High"] },
        })}
      />,
    );
    render(
      <KeyboardResponseComponent
        {...visualProps("KeyboardResponseComponent")}
      />,
    );
    render(<SketchpadComponent {...visualProps("SketchpadComponent")} />);
    render(
      <FileUploadResponseComponent
        {...visualProps("FileUploadResponseComponent")}
      />,
    );
    render(
      <ClickResponseComponent {...visualProps("ClickResponseComponent")} />,
    );
    render(
      <AudioResponseComponent {...visualProps("AudioResponseComponent")} />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("exercises selected transform branches with mocked Konva events", () => {
    const props = visualProps("FileUploadResponseComponent");
    const { container } = render(<FileUploadResponseComponent {...props} />);

    expect(container).toBeDefined();
    props.onChange({ x: nodeLike().x(), y: nodeLike().y() });
    expect(props.onChange).toHaveBeenCalledWith({ x: 11, y: 22 });
  });
});
