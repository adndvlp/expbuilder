/**
 * @fileoverview Utility to resolve CDN script/style URLs for jsPsych plugins.
 * Reads the plugin names stored on each trial and maps them to unpkg CDN URLs,
 * with special handling for webgazer and survey.
 * @module utils/plugin-scripts
 */

// ---------------------------------------------------------------------------
// Version map — keep in sync with jspsych-bundler/package.json dependencies
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const PLUGIN_VERSIONS = {
  // Core
  jspsych: "8.2.2",
  // Plugins with non-default versions
  "plugin-cloze": "2.2.0",
  "plugin-image-button-response": "2.2.0",
  "plugin-html-audio-response": "2.1.1",
  "plugin-video-button-response": "2.1.1",
  "plugin-video-keyboard-response": "2.1.1",
  "plugin-video-slider-response": "2.1.1",
  "plugin-virtual-chinrest": "3.1.0",
  "plugin-visual-search-circle": "2.2.0",
  "plugin-survey": "4.0.0",
  "extension-mouse-tracking": "1.2.0",
  "extension-record-video": "1.2.0",
  "extension-webgazer": "1.2.0",
  "plugin-webgazer-calibrate": "2.1.0",
  "plugin-webgazer-init-camera": "2.1.0",
  "plugin-webgazer-validate": "2.1.0",
};

/** Default version used for any @jspsych/* plugin not listed above */
const DEFAULT_PLUGIN_VERSION = "2.1.0";

// ---------------------------------------------------------------------------
// Special-case sets
// ---------------------------------------------------------------------------

/**
 * Plugins that require webgazer.js to be loaded first.
 * webgazer.js is NOT an @jspsych package — it has its own CDN URL.
 */
const WEBGAZER_DEPENDENT_PLUGINS = new Set([
  "extension-webgazer",
  "plugin-webgazer-calibrate",
  "plugin-webgazer-init-camera",
  "plugin-webgazer-validate",
]);

/**
 * URL for the webgazer.js library itself.
 * Must be inserted before any WEBGAZER_DEPENDENT_PLUGINS script.
 */
const WEBGAZER_JS_URL =
  "https://cdn.jsdelivr.net/gh/jspsych/jspsych@jspsych@7.0.0/examples/js/webgazer/webgazer.js";

/**
 * Plugins that also need the survey CSS stylesheet injected.
 * - plugin-survey: the standalone @jspsych/plugin-survey (SurveyJS-based)
 * - plugin-dynamic: DynamicPlugin contains SurveyComponent which uses survey-js-ui
 */
const SURVEY_CSS_PLUGINS = new Set(["plugin-survey", "plugin-dynamic"]);

/**
 * Plugins handled outside this system (served locally or via their own tag).
 * These are silently skipped when building the CDN list.
 */
const SKIP_PLUGINS = new Set(["plugin-dynamic"]);

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns the versioned unpkg URL for a single @jspsych/* plugin/extension.
 * @param {string} plugin - Short plugin name, e.g. "plugin-html-keyboard-response"
 * @returns {string}
 */
function pluginUrl(plugin) {
  const version = PLUGIN_VERSIONS[plugin] ?? DEFAULT_PLUGIN_VERSION;
  return `https://unpkg.com/@jspsych/${plugin}@${version}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves CDN URLs for a list of plugin names (as stored in trial.plugin).
 *
 * @param {string[]} pluginNames - Array of plugin short-names, possibly with duplicates.
 * @returns {{ scriptUrls: string[], styleUrls: string[] }}
 *   - `scriptUrls`: ordered list of JS URLs to inject as <script src="...">
 *   - `styleUrls`:  list of CSS URLs to inject as <link rel="stylesheet" href="...">
 *
 * @example
 * const { scriptUrls, styleUrls } = getPluginScripts([
 *   "plugin-html-keyboard-response",
 *   "plugin-survey",
 *   "extension-webgazer",
 *   "plugin-dynamic",   // skipped — served separately
 * ]);
 */
export function getPluginScripts(pluginNames) {
  const uniquePlugins = [...new Set(pluginNames.filter(Boolean))];

  const scriptUrls = [];
  const styleUrls = [];
  let needsWebgazer = false;

  for (const plugin of uniquePlugins) {
    // Handle side-effects (CSS, webgazer) before deciding whether to skip the JS URL

    if (WEBGAZER_DEPENDENT_PLUGINS.has(plugin)) {
      needsWebgazer = true;
    }

    if (SURVEY_CSS_PLUGINS.has(plugin)) {
      const version = PLUGIN_VERSIONS["plugin-survey"];
      styleUrls.push(
        `https://unpkg.com/@jspsych/plugin-survey@${version}/css/survey.css`,
      );
    }

    // plugin-dynamic is served locally — no CDN script URL needed
    if (SKIP_PLUGINS.has(plugin)) continue;

    scriptUrls.push(pluginUrl(plugin));
  }

  // webgazer.js must come before any webgazer-dependent plugin
  if (needsWebgazer) {
    scriptUrls.unshift(WEBGAZER_JS_URL);
  }

  return { scriptUrls, styleUrls };
}

/**
 * Convenience wrapper: extracts plugin names from a trials array and calls
 * {@link getPluginScripts}.
 *
 * @param {Array<{ plugin?: string }>} trials - Trial objects from db.data.trials[].trials
 * @returns {{ scriptUrls: string[], styleUrls: string[] }}
 */
export function getPluginScriptsFromTrials(trials) {
  const pluginNames = (trials ?? []).map((t) => t.plugin).filter(Boolean);
  return getPluginScripts(pluginNames);
}

/**
 * Converts the resolved URLs into ready-to-inject HTML tag strings.
 *
 * @param {string[]} scriptUrls
 * @param {string[]} styleUrls
 * @returns {{ scriptTags: string, styleTags: string }}
 *   Multi-line strings of <script> / <link> tags, suitable for cheerio append.
 */
export function buildHtmlTags(scriptUrls, styleUrls) {
  const scriptTags = scriptUrls
    .map((url) => `<script src="${url}"></script>`)
    .join("\n");
  const styleTags = styleUrls
    .map((url) => `<link rel="stylesheet" href="${url}" />`)
    .join("\n");
  return { scriptTags, styleTags };
}
