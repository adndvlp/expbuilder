import { DataDefinition, Trial } from "../../../types";

type Props = {
  selectedTrial: Trial | null;
  getPropValue: (prop: any) => any;
  data: DataDefinition[];
};

export default function useAvailableColumns({
  selectedTrial,
  getPropValue,
  data,
}: Props) {
  const getAvailableColumns = (): Array<{
    value: string;
    label: string;
    group?: string;
  }> => {
    if (!selectedTrial) return [];

    const columns: Array<{ value: string; label: string; group?: string }> = [];

    // For DynamicPlugin, generate columns from components
    if (selectedTrial.plugin === "plugin-dynamic") {
      const columnMapping = selectedTrial.columnMapping || {};

      // Process stimulus components
      const components = columnMapping.components?.value || [];
      components.forEach((comp: any) => {
        const prefix = getPropValue(comp.name);
        if (!prefix) return;

        // Add type column
        columns.push({
          value: `${prefix}_type`,
          label: `${prefix} › Type`,
          group: "Stimulus Components",
        });

        // Add stimulus column if exists
        if (getPropValue(comp.stimulus) !== undefined) {
          columns.push({
            value: `${prefix}_stimulus`,
            label: `${prefix} › Stimulus`,
            group: "Stimulus Components",
          });
        }

        // Add coordinates if exists
        if (getPropValue(comp.coordinates) !== undefined) {
          columns.push({
            value: `${prefix}_coordinates`,
            label: `${prefix} › Coordinates`,
            group: "Stimulus Components",
          });
        }

        // For SurveyComponent, add question columns
        const surveyJson = getPropValue(comp.survey_json);
        if (comp.type === "SurveyComponent" && surveyJson?.elements) {
          surveyJson.elements.forEach((q: any) => {
            columns.push({
              value: `${prefix}_${q.name}`,
              label: `${prefix} › ${q.name || q.title || "Question"}`,
              group: "Stimulus Components",
            });
          });
        }

        // Add response if component can respond
        if (
          comp.type === "SurveyComponent" ||
          comp.type === "SketchpadComponent"
        ) {
          columns.push({
            value: `${prefix}_response`,
            label: `${prefix} › Response`,
            group: "Stimulus Components",
          });
          columns.push({
            value: `${prefix}_rt`,
            label: `${prefix} › RT`,
            group: "Stimulus Components",
          });
        }
      });

      // Process response components
      const responseComponents = columnMapping.response_components?.value || [];
      responseComponents.forEach((comp: any) => {
        const prefix = getPropValue(comp.name);
        if (!prefix) return;

        columns.push({
          value: `${prefix}_type`,
          label: `${prefix} › Type`,
          group: "Response Components",
        });

        // For SurveyComponent, add question columns
        const surveyJson = getPropValue(comp.survey_json);
        const hasSurveyQuestions =
          comp.type === "SurveyComponent" &&
          surveyJson?.elements &&
          surveyJson.elements.length > 0;

        if (hasSurveyQuestions) {
          surveyJson.elements.forEach((q: any) => {
            columns.push({
              value: `${prefix}_${q.name}`,
              label: `${prefix} › ${q.name || q.title || "Question"}`,
              group: "Response Components",
            });
          });
        }

        // Only add generic response if NOT a SurveyComponent with questions
        if (!hasSurveyQuestions) {
          columns.push({
            value: `${prefix}_response`,
            label: `${prefix} › Response`,
            group: "Response Components",
          });
        }

        columns.push({
          value: `${prefix}_rt`,
          label: `${prefix} › RT`,
          group: "Response Components",
        });

        // SliderResponseComponent - slider_start
        if (comp.type === "SliderResponseComponent") {
          columns.push({
            value: `${prefix}_slider_start`,
            label: `${prefix} › Slider Start`,
            group: "Response Components",
          });
        }

        // SketchpadComponent - strokes and png
        if (comp.type === "SketchpadComponent") {
          columns.push({
            value: `${prefix}_strokes`,
            label: `${prefix} › Strokes`,
            group: "Response Components",
          });
          columns.push({
            value: `${prefix}_png`,
            label: `${prefix} › PNG`,
            group: "Response Components",
          });
        }

        // AudioResponseComponent - special fields
        if (comp.type === "AudioResponseComponent") {
          columns.push({
            value: `${prefix}_audio_url`,
            label: `${prefix} › Audio URL`,
            group: "Response Components",
          });
          columns.push({
            value: `${prefix}_estimated_stimulus_onset`,
            label: `${prefix} › Stimulus Onset`,
            group: "Response Components",
          });
        }
      });

      // Add general trial columns
      columns.push({
        value: "rt",
        label: "Trial RT",
        group: "Trial Data",
      });
    } else {
      // For normal plugins, use data fields
      data.forEach((field) => {
        columns.push({
          value: field.key,
          label: field.name || field.key,
          group: "Trial Data",
        });
      });
    }

    return columns;
  };
  return getAvailableColumns;
}
