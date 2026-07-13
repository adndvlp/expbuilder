import fs from "fs/promises";
import path from "path";

export async function copyToRefactorFolder(jsFile, pluginName, failedDir) {
  try {
    const content = await fs.readFile(jsFile, "utf-8");
    const failedPath = path.join(failedDir, `${pluginName}.js`);
    await fs.writeFile(failedPath, content);
    console.log(`Copied ${pluginName} to refactor folder`);
  } catch (err) {
    console.error(`Failed to copy ${pluginName}: ${err.message}`);
  }
}

export async function generateRefactorInstructions(pluginName, failedDir) {
  const instructions = `# Instructions to refactor ${pluginName}

## Problem
This plugin could not be processed automatically because it doesn't follow the expected standard format.

## Solution
Use any free LLM (ChatGPT, Claude, Copilot, etc.) with this prompt:

\`\`\`
Refactor this jsPsych plugin to have a standard info object:

REQUIRED FORMAT:
\`\`\`javascript
const info = {
  name: "${pluginName}",
  version: "1.0.0",
  parameters: {
    parameter_name: {
      type: "string", // use: string, number, boolean, function, object, array
      default: "default_value",
      description: "Parameter description"
    }
  },
  data: {
    property_name: {
      type: "string",
      description: "Data property description"
    }
  }
};
\`\`\`

DO NOT USE jspsych.ParameterType - use strings directly.

Original code:
[PASTE THE PLUGIN CODE HERE]

Return only the refactored JavaScript code.
\`\`\`

## After refactoring
1. Replace the original file in the plugins/ folder
2. Run extract-metadata.mjs again
`;

  const instructionsPath = path.join(
    failedDir,
    `${pluginName}-instructions.md`,
  );
  await fs.writeFile(instructionsPath, instructions);
  console.log(`Generated instructions for ${pluginName}`);
}
