import { MappedJson, expect, getColumnValue, it } from "./testHarness";

it.each([false, true])(
  "generates appearance and relative geometry with CSV for loop=%s",
  (isInLoop) => {
    const { mappedJson } = MappedJson({
      isInLoop,
      uploadedFiles: [],
      pluginName: "plugin-dynamic",
      columnMapping: {
        __canvasStyles: {
          source: "typed",
          value: {
            backgroundColor: "#abcdef",
            fullScreen: false,
            progressBar: false,
          },
        },
        components: {
          source: "typed",
          value: [
            {
              type: "TextComponent",
              coordinates: { x: -88, y: 88 },
              width: 25,
              text: { source: "csv", value: "label" },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: [
            {
              type: "ButtonResponseComponent",
              component_id: "finish",
              choices: { source: "typed", value: ["Continue"] },
            },
          ],
        },
      },
      getColumnValue,
      trialNameSanitized: "responsive",
      activeParameters: [],
      csvJson: [{ label: "First" }, { label: "Second" }],
      parameters: [],
    });
    const suffix = isInLoop ? "_responsive" : "";
    for (const [index, row] of mappedJson.entries()) {
      expect(row[`__canvasStyles${suffix}`]).toEqual({
        backgroundColor: "#abcdef",
        fullScreen: false,
        progressBar: false,
      });
      expect(row[`components${suffix}`][0]).toMatchObject({
        type: "TextComponent",
        coordinates: { x: -88, y: 88 },
        width: 25,
        text: index === 0 ? "First" : "Second",
      });
      expect(row[`response_components${suffix}`][0].component_id).toBe(
        "finish",
      );
    }
  },
);
