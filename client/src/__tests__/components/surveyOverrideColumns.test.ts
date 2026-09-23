import { describe, expect, it } from "vitest";
import { getAvailableColumns } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow/services/getAvailableColumns";
import type { LoadedTrial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/types";

const getPropValue = (prop: unknown) =>
  prop && typeof prop === "object" && "value" in prop
    ? (prop as { value: unknown }).value
    : prop;

describe("getAvailableColumns for surveys", () => {
  it("lists survey questions that live inside pages", () => {
    const referencedTrial = {
      plugin: "plugin-dynamic",
      columnMapping: {
        response_components: {
          value: [
            {
              type: "SurveyComponent",
              name: { source: "typed", value: "Survey_1" },
              survey_json: {
                source: "typed",
                value: {
                  pages: [
                    {
                      elements: [
                        { name: "mood", title: "Mood question" },
                        { name: "sleep" },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    } as unknown as LoadedTrial;

    const columns = getAvailableColumns({
      dataFields: [],
      getPropValue,
      referencedTrial,
    });

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "Survey_1_mood",
          label: "Survey_1 › Mood question",
          group: "Response Components",
        }),
        expect.objectContaining({
          value: "Survey_1_sleep",
          label: "Survey_1 › sleep",
        }),
      ]),
    );
    expect(columns.some((column) => column.value === "Survey_1_response")).toBe(
      false,
    );
  });
});
