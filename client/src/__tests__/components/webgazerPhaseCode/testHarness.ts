import { useState } from "react";
import { vi } from "vitest";
import { generatePhaseCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/generatePhaseCode";
import type {
  ColumnMapping,
  Trial,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/hooks/usePluginParameters",
  () => ({
    usePluginParameters: vi.fn((pluginName: string) => {
      const metadata = {
        "plugin-webgazer-init-camera": {
          parameters: [
            {
              key: "message",
              label: "Message",
              type: "html_string",
              default: "",
            },
            {
              key: "button_html",
              label: "Button HTML",
              type: "function",
              default: "",
            },
          ],
          data: [{ key: "phase", label: "Phase", type: "string" }],
        },
        "plugin-webgazer-validate": {
          parameters: [
            {
              key: "validation_points",
              label: "Validation Points",
              type: "number_array",
              default: [],
            },
          ],
          data: [
            {
              key: "percent_in_roi",
              label: "Percent ROI",
              type: "number_array",
            },
          ],
        },
        "plugin-webgazer-recalibrate": { parameters: [], data: [] },
      } as Record<
        string,
        {
          parameters: Array<{
            key: string;
            label: string;
            type: string;
            default?: unknown;
          }>;
          data: Array<{ key: string; label: string; type: string }>;
        }
      >;

      return {
        parameters: metadata[pluginName]?.parameters ?? [],
        data: metadata[pluginName]?.data ?? [],
        loading: false,
        error: null,
      };
    }),
  }),
);

export function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

export function useWebgazerPhaseHarness({
  pluginName,
  instructions = [],
  initialMapping = {},
  initialCsvJson = [],
  selectedTrial = null,
}: {
  pluginName: string;
  instructions?: Array<{
    key: string;
    label: string;
    type: string;
    default?: unknown;
  }>;
  initialMapping?: ColumnMapping;
  initialCsvJson?: any[];
  selectedTrial?: Trial | null;
}) {
  const [csvJson, setCsvJson] = useState(initialCsvJson);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [trialName, setTrialName] = useState("");
  const [columnMapping, setColumnMapping] =
    useState<ColumnMapping>(initialMapping);
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);
  const phase = generatePhaseCode({
    pluginName,
    instructions,
    csvJson,
    setCsvJson,
    selectedTrial,
    setTrialName,
    setCsvColumns,
    columnMapping,
    setColumnMapping,
    setIsLoadingTrial,
  });
  return {
    phase,
    csvJson,
    csvColumns,
    trialName,
    columnMapping,
    isLoadingTrial,
  };
}
