import { useState } from "react";
import type React from "react";
import { afterEach, vi } from "vitest";
import CustomSurveyEditor from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder";
import QuestionEditor from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/QuestionEditor";
import ThemeCustomization from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/ThemeCustomization";
import type {
  ChoiceItem,
  Question,
  RateValue,
  UploadedFile,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/types";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesHtmlEditor",
  () => ({
    default: ({ isOpen, onClose, onChange, title }: any) =>
      isOpen ? (
        <div role="dialog" aria-label={title}>
          <button
            type="button"
            onClick={() => onChange("<section>Visual HTML</section>")}
          >
            Apply visual HTML
          </button>
          <button type="button" onClick={onClose}>
            Close visual HTML
          </button>
        </div>
      ) : null,
  }),
);

function SurveyHarness({
  initial,
  uploadedFiles,
  onChange,
}: {
  initial: Record<string, unknown>;
  uploadedFiles?: UploadedFile[];
  onChange?: (json: Record<string, unknown>) => void;
}) {
  const [surveyJson, setSurveyJson] = useState(initial);

  return (
    <>
      <CustomSurveyEditor
        surveyJson={surveyJson}
        uploadedFiles={uploadedFiles}
        onChange={(next) => {
          setSurveyJson(next);
          onChange?.(next);
        }}
      />
      <output data-testid="survey-json">{JSON.stringify(surveyJson)}</output>
    </>
  );
}

function QuestionHarness({
  initial,
  uploadedFiles = [],
  canMoveUp = true,
  canMoveDown = true,
  onMove = vi.fn(),
  onDelete = vi.fn(),
}: {
  initial: Question;
  uploadedFiles?: UploadedFile[];
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: "up" | "down") => void;
  onDelete?: () => void;
}) {
  const [question, setQuestion] = useState(initial);

  function normalizeChoice(choice: string | ChoiceItem): ChoiceItem {
    if (typeof choice === "string")
      return { value: choice, text: choice, imageLink: "" };
    return choice;
  }

  function normalizeRateValue(rateValue: RateValue): RateValue {
    return rateValue;
  }

  return (
    <>
      <QuestionEditor
        question={question}
        index={0}
        isExpanded
        onToggleExpand={vi.fn()}
        onUpdate={(updates) => setQuestion((prev) => ({ ...prev, ...updates }))}
        onDelete={onDelete}
        onMove={onMove}
        onAddChoice={() =>
          setQuestion((prev) => ({
            ...prev,
            choices: [
              ...(prev.choices ?? []),
              { value: "", text: "", imageLink: "" },
            ],
          }))
        }
        onUpdateChoice={(choiceIndex, field, value) =>
          setQuestion((prev) => {
            const choices = (prev.choices ?? []).map(normalizeChoice);
            const current = choices[choiceIndex] ?? {
              value: "",
              text: "",
              imageLink: "",
            };
            choices[choiceIndex] = {
              ...current,
              [field]: value,
              ...(field === "text" ? { value } : {}),
            };
            return { ...prev, choices };
          })
        }
        onRemoveChoice={(choiceIndex) =>
          setQuestion((prev) => ({
            ...prev,
            choices: (prev.choices ?? []).filter(
              (_, index) => index !== choiceIndex,
            ),
          }))
        }
        onAddRateValue={() =>
          setQuestion((prev) => ({
            ...prev,
            rateValues: [...(prev.rateValues ?? []), { value: "", text: "" }],
          }))
        }
        onUpdateRateValue={(rateIndex, value) =>
          setQuestion((prev) => {
            const rateValues = (prev.rateValues ?? []).map(normalizeRateValue);
            rateValues[rateIndex] = { value, text: value };
            return { ...prev, rateValues };
          })
        }
        onRemoveRateValue={(rateIndex) =>
          setQuestion((prev) => ({
            ...prev,
            rateValues: (prev.rateValues ?? []).filter(
              (_, index) => index !== rateIndex,
            ),
          }))
        }
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        uploadedFiles={uploadedFiles}
      />
      <output data-testid="question-json">{JSON.stringify(question)}</output>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

function ThemeCustomizationHarness(
  props: React.ComponentProps<typeof ThemeCustomization>,
) {
  return <ThemeCustomization {...props} />;
}

export { QuestionHarness, SurveyHarness, ThemeCustomizationHarness };
