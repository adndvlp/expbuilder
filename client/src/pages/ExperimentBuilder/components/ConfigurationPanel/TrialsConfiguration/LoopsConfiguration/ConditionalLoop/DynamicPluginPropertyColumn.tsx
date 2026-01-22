import { LoopCondition, LoopConditionRule } from "./types";
import { updateProp } from "./ruleUpdateHelpers";

type Props = {
  rule: LoopConditionRule;
  comp: unknown | null;
  componentIdx: string;
  conditionId: number;
  ruleIdx: number;
  conditions: LoopCondition[];
  setConditionsWrapper: (
    conditions: LoopCondition[],
    shouldSave?: boolean,
  ) => void;
  getPropValue: (prop: unknown) => unknown;
};

/**
 * Renders the property/question selector for dynamic plugins
 * Handles SurveyComponent, ButtonResponseComponent, and generic components
 */
export function DynamicPluginPropertyColumn({
  rule,
  comp,
  componentIdx,
  conditionId,
  ruleIdx,
  conditions,
  setConditionsWrapper,
  getPropValue,
}: Props) {
  // Get available properties for the component
  const getAvailableProperties = (): Array<{
    value: string;
    label: string;
  }> => {
    if (!comp) return [];

    const properties: Array<{ value: string; label: string }> = [];
    const compType = (comp as { type?: string }).type;

    // Always add type
    properties.push({ value: "type", label: "Type" });

    // Survey Component - Add survey_json questions
    if (compType === "SurveyComponent") {
      const surveyJson = getPropValue(
        (comp as { survey_json?: unknown }).survey_json,
      ) as { elements?: Array<{ name: string; title?: string }> } | undefined;

      if (surveyJson?.elements && surveyJson.elements.length > 0) {
        surveyJson.elements.forEach((q) => {
          properties.push({
            value: q.name,
            label: q.title || q.name,
          });
        });
      } else {
        // Generic response if no questions
        properties.push({ value: "response", label: "Response" });
      }
      properties.push({ value: "rt", label: "RT" });
    }
    // Button Response Component
    else if (compType === "ButtonResponseComponent") {
      properties.push({ value: "response", label: "Response" });
      properties.push({ value: "rt", label: "RT" });
    }
    // Slider Response Component
    else if (compType === "SliderResponseComponent") {
      properties.push({ value: "response", label: "Response" });
      properties.push({ value: "rt", label: "RT" });
      properties.push({ value: "slider_start", label: "Slider Start" });
    }
    // Sketchpad Component
    else if (compType === "SketchpadComponent") {
      properties.push({ value: "response", label: "Response" });
      properties.push({ value: "rt", label: "RT" });
      properties.push({ value: "strokes", label: "Strokes" });
      properties.push({ value: "png", label: "PNG" });
    }
    // Audio Response Component
    else if (compType === "AudioResponseComponent") {
      properties.push({ value: "response", label: "Response" });
      properties.push({ value: "rt", label: "RT" });
      properties.push({ value: "audio_url", label: "Audio URL" });
      properties.push({
        value: "estimated_stimulus_onset",
        label: "Stimulus Onset",
      });
    }
    // HTML, Image, Audio components (stimulus components)
    else if (
      compType === "HtmlComponent" ||
      compType === "ImageComponent" ||
      compType === "AudioComponent"
    ) {
      if ("stimulus" in (comp as { stimulus?: unknown })) {
        properties.push({ value: "stimulus", label: "Stimulus" });
      }
      if ("coordinates" in (comp as { coordinates?: unknown })) {
        properties.push({ value: "coordinates", label: "Coordinates" });
      }
    }
    // Generic component - add common properties
    else {
      if ("stimulus" in (comp as { stimulus?: unknown })) {
        properties.push({ value: "stimulus", label: "Stimulus" });
      }
      if ("response" in (comp as { response?: unknown })) {
        properties.push({ value: "response", label: "Response" });
      }
      if ("rt" in (comp as { rt?: unknown })) {
        properties.push({ value: "rt", label: "RT" });
      }
      if ("coordinates" in (comp as { coordinates?: unknown })) {
        properties.push({ value: "coordinates", label: "Coordinates" });
      }
    }

    return properties;
  };

  const availableProperties = getAvailableProperties();

  return (
    <select
      value={rule.prop}
      onChange={(e) => {
        const newValue = e.target.value;
        setConditionsWrapper(
          updateProp(conditions, conditionId, ruleIdx, newValue),
          true,
        );
      }}
      disabled={!componentIdx}
      className="border rounded px-2 py-1 w-full text-xs"
      style={{
        color: "var(--text-dark)",
        backgroundColor: "var(--neutral-light)",
        borderColor: "var(--neutral-mid)",
      }}
    >
      <option value="">Select property</option>
      {availableProperties.map((prop) => (
        <option key={prop.value} value={prop.value}>
          {prop.label}
        </option>
      ))}
    </select>
  );
}
