import path from "path";
import { fileURLToPath } from "url";
import { extractInfoObjects } from "./extract-metadata/runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await extractInfoObjects({
  pluginsDir: [path.resolve(__dirname, "./plugins")],
  outputDir: path.resolve(__dirname, "metadata"),
  failedDir: path.resolve(__dirname, "plugins_refactor"),
});
