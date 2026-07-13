import fs from "fs";
import * as cheerio from "cheerio";
import { ensureTemplate } from "../../utils/templates.js";

const templateNames = [
  "experiment_template.html",
  "trials_preview_template.html",
];

export function refreshPluginScripts(plugins) {
  const htmlPaths = templateNames.map((name) => ensureTemplate(name));

  for (const htmlPath of htmlPaths) {
    let html = fs.readFileSync(htmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script[id^='plugin-script']").remove();
    plugins.forEach((plugin, idx) => {
      if (plugin.scripTag) {
        $("body").append(
          `<script src="${plugin.scripTag}" id="plugin-script-${idx}"></script>`,
        );
      }
    });
    fs.writeFileSync(htmlPath, $.html(), "utf8");
  }
}

export function removePluginScript(index) {
  const htmlPaths = templateNames.map((name) => ensureTemplate(name));

  htmlPaths.forEach((htmlPath) => {
    /* istanbul ignore else -- ensureTemplate returns an existing path or throws before this loop. */
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      const $ = cheerio.load(html);
      $(`script#plugin-script-${index}`).remove();
      fs.writeFileSync(htmlPath, $.html(), "utf8");
    }
  });
}
