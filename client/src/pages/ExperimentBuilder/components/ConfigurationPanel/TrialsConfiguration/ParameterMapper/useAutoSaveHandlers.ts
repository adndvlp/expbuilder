import React from "react";
import { ColumnMappingEntry, Parameter } from ".";

type Props = {
  parameters: Parameter[];
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  onSave?: ((key: string, value: any) => void) | undefined;
  currentHtmlKey: string;
  currentButtonKey: string;
  currentSurveyKey: string;
};

export default function useAutoSaveHandlers({
  currentHtmlKey,
  parameters,
  setColumnMapping,
  currentButtonKey,
  currentSurveyKey,
  onSave,
}: Props) {
  const handleHtmlChange = (htmlValue: string) => {
    if (currentHtmlKey) {
      const param = parameters.find((p) => p.key === currentHtmlKey);
      const isHtmlArray = param?.type === "html_string_array";
      const newValue = {
        source: "typed" as const,
        value: isHtmlArray ? [htmlValue] : htmlValue,
      };

      setColumnMapping((prev) => ({
        ...prev,
        [currentHtmlKey]: newValue,
      }));

      // Autoguardar después de cambiar HTML
      if (onSave) {
        setTimeout(() => onSave(currentHtmlKey, newValue), 100);
      }
    }
  };

  const handleButtonHtmlChange = (htmlTemplate: string) => {
    if (currentButtonKey) {
      // Parse HTML to extract all button elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlTemplate, "text/html");
      const buttons = Array.from(doc.querySelectorAll("button"));

      if (buttons.length === 0) {
        alert(
          "No buttons found in the template. Please add at least one button.",
        );
        return;
      }

      // Extract choices from button text content
      const extractedChoices = buttons.map(
        (btn) => btn.textContent?.trim() || "Button",
      );

      // Store the button elements as templates indexed by their position
      const buttonTemplates = buttons.map((btn) => btn.outerHTML);

      // Create button_html function that returns the template for each choice_index
      const functionString = `(choice, choice_index) => {
  const templates = ${JSON.stringify(buttonTemplates)};
  return templates[choice_index] || templates[0];
}`;

      // Update both button_html and choices
      const buttonValue = { source: "typed" as const, value: functionString };
      const choicesValue = {
        source: "typed" as const,
        value: extractedChoices,
      };

      setColumnMapping((prev) => ({
        ...prev,
        [currentButtonKey]: buttonValue,
        // Also update choices if they exist in the parameters
        ...(parameters.some((p) => p.key === "choices") && {
          choices: choicesValue,
        }),
      }));

      // Autoguardar después de cambiar botones
      if (onSave) {
        setTimeout(() => {
          onSave(currentButtonKey, buttonValue);
          if (parameters.some((p) => p.key === "choices")) {
            onSave("choices", choicesValue);
          }
        }, 100);
      }
    }
  };

  const handleSurveyChange = (surveyJson: object) => {
    if (currentSurveyKey) {
      const newValue = { source: "typed" as const, value: surveyJson };

      setColumnMapping((prev) => ({
        ...prev,
        [currentSurveyKey]: newValue,
      }));

      // Autoguardar después de cambiar survey
      if (onSave) {
        setTimeout(() => onSave(currentSurveyKey, newValue), 100);
      }
    }
  };

  return { handleHtmlChange, handleButtonHtmlChange, handleSurveyChange };
}
