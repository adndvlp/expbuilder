import { Trial } from "../components/ConfigPanel/types";

export function createDefaultTrial(): Trial {
  return {
    id: Date.now(),
    plugin: "plugin-dynamic",
    name: "New Trial",
    parameters: {},
    trialCode: "",
    columnMapping: {
      components: {
        source: "typed",
        value: [
          {
            type: "HtmlComponent",
            stimulus:
              '<div id="i9zw" style="box-sizing: border-box;">Welcome to the experiment, press \'Start\' to begin</div>',
            coordinates: { x: 0, y: 0 },
            width: 200,
            height: 50,
          },
        ],
      },
      response_components: {
        source: "typed",
        value: [
          {
            type: "ButtonResponseComponent",
            choices: ["Start"],
            coordinates: { x: 0, y: 0.15 },
            width: 200,
            height: 50,
          },
        ],
      },
    },
    type: "Trial",
  };
}
