import type { DataDefinition } from "../../../../types";
import type { LoadedTrial } from "../../types";

export interface AvailableColumn {
  value: string;
  label: string;
  group: string;
}

interface Args {
  dataFields: DataDefinition[];
  getPropValue: (prop: unknown) => unknown;
  referencedTrial: LoadedTrial | null;
}

type DynamicComponent = {
  name?: unknown;
  type?: string;
  stimulus?: unknown;
  coordinates?: unknown;
  survey_json?: unknown;
  [key: string]: unknown;
};

export function getAvailableColumns({
  dataFields,
  getPropValue,
  referencedTrial,
}: Args): AvailableColumn[] {
  if (!referencedTrial) return [];
  if (referencedTrial.plugin !== "plugin-dynamic") {
    return dataFields.map((field) => ({
      value: field.key,
      label: field.label || field.key,
      group: "Trial Data",
    }));
  }

  const columns: AvailableColumn[] = [];
  const columnMapping = referencedTrial.columnMapping || {};
  const components =
    (columnMapping.components as { value?: unknown[] } | undefined)?.value ||
    [];
  (components as DynamicComponent[]).forEach((component) => {
    addStimulusColumns(columns, component, getPropValue);
  });

  const responseComponents =
    (columnMapping.response_components as { value?: unknown[] } | undefined)
      ?.value || [];
  (responseComponents as DynamicComponent[]).forEach((component) => {
    addResponseColumns(columns, component, getPropValue);
  });

  columns.push({ value: "rt", label: "Trial RT", group: "Trial Data" });
  return columns;
}

function addStimulusColumns(
  columns: AvailableColumn[],
  component: DynamicComponent,
  getPropValue: (prop: unknown) => unknown,
) {
  const prefix = getPropValue(component.name);
  if (!prefix) return;
  const name = String(prefix);
  const group = "Stimulus Components";

  columns.push({ value: `${name}_type`, label: `${name} › Type`, group });
  if (getPropValue(component.stimulus) !== undefined) {
    columns.push({
      value: `${name}_stimulus`,
      label: `${name} › Stimulus`,
      group,
    });
  }
  if (getPropValue(component.coordinates) !== undefined) {
    columns.push({
      value: `${name}_coordinates`,
      label: `${name} › Coordinates`,
      group,
    });
  }

  const questions = getSurveyQuestions(component, getPropValue);
  if (component.type === "SurveyComponent") {
    questions.forEach((question) => {
      columns.push({
        value: `${name}_${question.name}`,
        label: `${name} › ${question.title || question.name || "Question"}`,
        group,
      });
    });
  }
  if (
    component.type === "SurveyComponent" ||
    component.type === "SketchpadComponent"
  ) {
    columns.push({
      value: `${name}_response`,
      label: `${name} › Response`,
      group,
    });
    columns.push({ value: `${name}_rt`, label: `${name} › RT`, group });
  }
}

function addResponseColumns(
  columns: AvailableColumn[],
  component: DynamicComponent,
  getPropValue: (prop: unknown) => unknown,
) {
  const prefix = getPropValue(component.name);
  if (!prefix) return;
  const name = String(prefix);
  const group = "Response Components";
  columns.push({ value: `${name}_type`, label: `${name} › Type`, group });

  const questions = getSurveyQuestions(component, getPropValue);
  const hasSurveyQuestions =
    component.type === "SurveyComponent" && questions.length > 0;
  if (hasSurveyQuestions) {
    questions.forEach((question) => {
      columns.push({
        value: `${name}_${question.name}`,
        label: `${name} › ${question.title || question.name || "Question"}`,
        group,
      });
    });
  }
  if (!hasSurveyQuestions) {
    columns.push({
      value: `${name}_response`,
      label: `${name} › Response`,
      group,
    });
  }
  columns.push({ value: `${name}_rt`, label: `${name} › RT`, group });

  if (component.type === "SliderResponseComponent") {
    columns.push({
      value: `${name}_slider_start`,
      label: `${name} › Slider Start`,
      group,
    });
  }
  if (component.type === "SketchpadComponent") {
    columns.push({
      value: `${name}_strokes`,
      label: `${name} › Strokes`,
      group,
    });
    columns.push({ value: `${name}_png`, label: `${name} › PNG`, group });
  }
  if (component.type === "AudioResponseComponent") {
    columns.push({
      value: `${name}_audio_url`,
      label: `${name} › Audio URL`,
      group,
    });
    columns.push({
      value: `${name}_estimated_stimulus_onset`,
      label: `${name} › Stimulus Onset`,
      group,
    });
  }
}

function getSurveyQuestions(
  component: DynamicComponent,
  getPropValue: (prop: unknown) => unknown,
) {
  const surveyJson = getPropValue(component.survey_json) as
    | { elements?: Array<{ name: string; title?: string }> }
    | undefined;
  return surveyJson?.elements || [];
}
