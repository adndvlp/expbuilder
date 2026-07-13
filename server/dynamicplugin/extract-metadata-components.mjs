import path from "path";
import { fileURLToPath } from "url";
import { extractAllComponents } from "./extract-metadata-components/runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await extractAllComponents({
  componentsDir: path.resolve(__dirname, "./components"),
  responseComponentsDir: path.resolve(__dirname, "./response_components"),
  pluginFile: path.resolve(__dirname, "./index.ts"),
  metadataDir: path.join(__dirname, "../metadata"),
  outputDir: path.join(__dirname, "../components-metadata"),
});
