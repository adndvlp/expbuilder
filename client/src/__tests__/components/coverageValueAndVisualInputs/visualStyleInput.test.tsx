import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VisualStyleInput, {
  getVisualDefaultValue,
  getVisualStylePriority,
  isVisualColorParameter,
  isVisualStyleParameter,
  numericConfig,
  shouldSpanVisualControl,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/VisualStyleInput";
import { invokeSetter, renderVisualInput } from "./testHarness";

describe("coverage VisualStyleInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("classifies visual style parameters and returns defaults/priorities", () => {
    expect(isVisualColorParameter("stroke_color")).toBe(true);
    expect(isVisualColorParameter("custom_color")).toBe(true);
    expect(isVisualStyleParameter("font_family")).toBe(true);
    expect(isVisualStyleParameter("custom_font_size", "number")).toBe(true);
    expect(isVisualStyleParameter("custom_border", "number")).toBe(true);
    expect(isVisualStyleParameter("custom_radius", "number")).toBe(true);
    expect(isVisualStyleParameter("plain", "string")).toBe(false);
    expect(shouldSpanVisualControl("border_radius")).toBe(true);
    expect(getVisualStylePriority("text")).toBe(0);
    expect(getVisualStylePriority("unknown")).toBe(1000);
    expect(getVisualDefaultValue("font_weight")).toBe("normal");
    expect(getVisualDefaultValue("font_style")).toBe("normal");
    expect(getVisualDefaultValue("text_align")).toBe("center");
    expect(getVisualDefaultValue("font_family")).toBe("sans-serif");
    expect(getVisualDefaultValue("line_height")).toBe(1.5);
    expect(getVisualDefaultValue("border_width")).toBe(0);
    expect(getVisualDefaultValue("border_radius")).toBe(0);
    expect(getVisualDefaultValue("stroke_width")).toBe(3);
    expect(getVisualDefaultValue("marker_radius")).toBe(8);
    expect(getVisualDefaultValue("font_size")).toBe(16);
    expect(getVisualDefaultValue("background_color")).toBe("transparent");
    expect(getVisualDefaultValue("border_color")).toBe("transparent");
    expect(getVisualDefaultValue("button_color")).toBe("#e7e7e7");
    expect(getVisualDefaultValue("button_text_color")).toBe("#000000");
    expect(getVisualDefaultValue("font_color")).toBe("#000000");
    expect(getVisualDefaultValue("unknown_number", "number")).toBe(0);
    expect(getVisualDefaultValue("plain")).toBe("");
    expect(numericConfig("custom_numeric")).toEqual({
      min: 0,
      max: 1000,
      step: 1,
    });
  });

  it("commits font family, numeric changes and clamps numeric values", () => {
    const familyProps = renderVisualInput({
      paramKey: "font_family",
      type: "string",
      entry: { source: "typed", value: "Arial" },
      label: "Font family",
    });
    fireEvent.change(screen.getByLabelText("Font family"), {
      target: { value: "Georgia" },
    });
    expect(invokeSetter(familyProps.setColumnMapping, {})).toEqual({
      font_family: { source: "typed", value: "Georgia" },
    });
    expect(
      invokeSetter(familyProps.setLocalInputValues, {
        font_family: "Arial",
        keep: "value",
      }),
    ).toEqual({ keep: "value" });
    vi.runOnlyPendingTimers();
    expect(familyProps.onSave).toHaveBeenCalledWith("font_family", {
      source: "typed",
      value: "Georgia",
    });

    const fallbackFamilyProps = renderVisualInput({
      paramKey: "button_font_family",
      type: "string",
      entry: { source: "typed", value: null },
      label: "Button font family",
      onSave: undefined,
    });
    expect(screen.getByLabelText("Button font family")).toHaveValue(
      "sans-serif",
    );
    fireEvent.change(screen.getByLabelText("Button font family"), {
      target: { value: "serif" },
    });
    expect(invokeSetter(fallbackFamilyProps.setColumnMapping, {})).toEqual({
      button_font_family: { source: "typed", value: "serif" },
    });

    renderVisualInput({
      localInputValues: { input_font_family: 42 },
      paramKey: "input_font_family",
      type: "string",
      entry: { source: "typed", value: 42 },
      label: "Input font family",
    });
    expect(screen.getByLabelText("Input font family")).toHaveValue(
      "sans-serif",
    );

    const numericProps = renderVisualInput({
      paramKey: "font_size",
      entry: { source: "typed", value: 16 },
      label: "Font size",
    });
    fireEvent.click(screen.getByLabelText("Increase Font size"));
    expect(invokeSetter(numericProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 17 },
    });
    fireEvent.click(screen.getByLabelText("Decrease Font size"));
    expect(invokeSetter(numericProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 15 },
    });

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "9999" } });
    expect(numericProps.setLocalInputValues).toHaveBeenCalled();
    expect(
      invokeSetter(numericProps.setLocalInputValues, { keep: "value" }),
    ).toEqual({
      keep: "value",
      font_size: "16",
    });
    fireEvent.blur(input, { target: { value: "9999" } });
    expect(invokeSetter(numericProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 240 },
    });

    const lineProps = renderVisualInput({
      paramKey: "line_height",
      entry: { source: "typed", value: "not-a-number" },
      label: "Line height",
    });
    fireEvent.blur(screen.getByLabelText("Line height"), {
      target: { value: "bad" },
    });
    expect(invokeSetter(lineProps.setColumnMapping, {})).toEqual({
      line_height: { source: "typed", value: 1.5 },
    });

    const emptyFontProps = renderVisualInput({
      paramKey: "font_size",
      entry: { source: "typed", value: 18 },
      label: "Empty font size",
    });
    fireEvent.blur(screen.getByLabelText("Empty font size"), {
      target: { value: "" },
    });
    expect(invokeSetter(emptyFontProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 18 },
    });

    const invalidBorderProps = renderVisualInput({
      paramKey: "border_width",
      entry: { source: "typed", value: "invalid" },
      label: "Invalid border width",
    });
    fireEvent.click(screen.getByLabelText("Increase Invalid border width"));
    expect(invokeSetter(invalidBorderProps.setColumnMapping, {})).toEqual({
      border_width: { source: "typed", value: 1 },
    });

    (
      [
        ["border_width", "Border width", 1],
        ["border_radius", "Border radius", 1],
        ["stroke_width", "Stroke width", 4],
        ["marker_radius", "Marker radius", 9],
      ] as const
    ).forEach(([paramKey, label, expected]) => {
      const props = renderVisualInput({
        paramKey,
        entry: { source: "typed", value: getVisualDefaultValue(paramKey) },
        label,
      });
      fireEvent.click(screen.getByLabelText(`Increase ${label}`));
      expect(invokeSetter(props.setColumnMapping, {})).toEqual({
        [paramKey]: { source: "typed", value: expected },
      });
    });
  });

  it("commits toggle and alignment buttons and renders null for unsupported keys", () => {
    const boldProps = renderVisualInput({
      paramKey: "font_weight",
      type: "string",
      entry: { source: "typed", value: "normal" },
      label: "Font weight",
    });
    fireEvent.click(screen.getByLabelText("Bold"));
    expect(invokeSetter(boldProps.setColumnMapping, {})).toEqual({
      font_weight: { source: "typed", value: "bold" },
    });

    const activeBoldProps = renderVisualInput({
      paramKey: "font_weight",
      type: "string",
      entry: { source: "typed", value: "bold" },
      label: "Active font weight",
    });
    fireEvent.click(screen.getAllByLabelText("Bold").at(-1)!);
    expect(invokeSetter(activeBoldProps.setColumnMapping, {})).toEqual({
      font_weight: { source: "typed", value: "normal" },
    });

    const italicProps = renderVisualInput({
      paramKey: "font_style",
      type: "string",
      entry: { source: "typed", value: "italic" },
      label: "Font style",
    });
    fireEvent.click(screen.getByLabelText("Italic"));
    expect(invokeSetter(italicProps.setColumnMapping, {})).toEqual({
      font_style: { source: "typed", value: "normal" },
    });

    const inactiveItalicProps = renderVisualInput({
      paramKey: "font_style",
      type: "string",
      entry: { source: "typed", value: "normal" },
      label: "Inactive font style",
    });
    fireEvent.click(screen.getAllByLabelText("Italic").at(-1)!);
    expect(invokeSetter(inactiveItalicProps.setColumnMapping, {})).toEqual({
      font_style: { source: "typed", value: "italic" },
    });

    const alignProps = renderVisualInput({
      paramKey: "text_align",
      type: "string",
      entry: { source: "typed", value: "bogus" },
      label: "Text align",
    });
    fireEvent.click(screen.getByLabelText("Align right"));
    expect(invokeSetter(alignProps.setColumnMapping, {})).toEqual({
      text_align: { source: "typed", value: "right" },
    });

    renderVisualInput({
      paramKey: "text_align",
      type: "string",
      entry: { source: "typed", value: "left" },
      label: "Left text align",
    });
    expect(screen.getAllByLabelText("Align left").at(-1)).toHaveStyle({
      background: "#164e63",
    });

    const { container } = render(
      <VisualStyleInput
        localInputValues={{}}
        setColumnMapping={vi.fn()}
        paramKey="plain"
        type="string"
        entry={{ source: "typed", value: "ignored" }}
        label="Plain"
        onSave={undefined}
        setLocalInputValues={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
