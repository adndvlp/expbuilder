# 04 - Plugin System

The application supports three types of jsPsych plugins:

## 1. Dynamic Plugin (`plugin-dynamic`)

The custom-built plugin that allows creating trials by composing visual and response components on a canvas.

### Architecture

```
server/dynamicplugin/
├── index.ts                    # Main DynamicPlugin class (jsPsych plugin)
├── components/                 # Stimulus components
│   ├── ImageComponent.ts       # Display images
│   ├── VideoComponent.ts       # Display videos
│   ├── HtmlComponent.ts        # Display arbitrary HTML
│   ├── TextComponent.ts        # Display text
│   ├── AudioComponent.ts       # Play audio
│   └── SketchpadComponent.ts   # Drawing canvas (acts as stimulus + response)
└── response_components/        # Response/input components
    ├── ButtonResponseComponent.ts      # Clickable buttons
    ├── ClickResponseComponent.ts       # Click/tap anywhere
    ├── SliderResponseComponent.ts      # Slider input
    ├── KeyboardResponseComponent.ts    # Keyboard input
    ├── InputResponseComponent.ts       # Text input
    ├── SurveyComponent.ts              # SurveyJS-based survey
    ├── AudioResponseComponent.ts       # Audio recording
    └── FileUploadResponseComponent.ts  # File upload
```

### Component Map (registration)

```typescript
// server/dynamicplugin/index.ts
const COMPONENT_MAP = {
  ImageComponent, VideoComponent, HtmlComponent,
  TextComponent, AudioComponent,
};

const RESPONSE_COMPONENT_MAP = {
  ButtonResponseComponent, ClickResponseComponent,
  SliderResponseComponent, KeyboardResponseComponent,
  InputResponseComponent, SurveyComponent,
  SketchpadComponent, AudioResponseComponent,
  FileUploadResponseComponent,
};
```

### Dynamic Plugin Parameters

```typescript
{
  __canvasStyles: {
    type: COMPLEX,
    default: { width: 1024, height: 768 }
  },
  components: {
    type: COMPLEX, array: true,  // Array of stimulus component configs
    default: []
  },
  response_components: {
    type: COMPLEX, array: true,  // Array of response component configs
    default: []
  },
  require_response: {
    type: BOOL, default: false    // All response components must pass validation
  },
  trial_duration: {
    type: INT, default: null     // Time limit in ms
  },
  response_ends_trial: {
    type: BOOL, default: true    // End trial on response
  }
}
```

### Trial Execution Flow

1. Create main container (`#jspsych-dynamic-plugin-container`)
2. Scale to viewport using `__canvasStyles` dimensions
3. Instantiate all stimulus and response components
4. Sort by `zIndex` for layering
5. Render all components in parallel
6. `response_ends_trial`:
   - If true: end on first response (with `require_response` validation)
   - If false: wait for `trial_duration`
7. Collect data from all components (flat structure, prefixed by component name)
8. Clean up components + observer

### Screen Layout Resolution

The `resolveScreenLayout()` function picks the best-fitting layout for the current viewport:
- Checks `config.screenLayouts` (map of `"WxH"` → layout config)
- Uses width-axis Manhattan distance with 200px threshold
- Falls back to default layout if no close match

### Visual Designer (Frontend)

The `TrialDesigner` component provides:
- Konva.js canvas for drag-and-drop component placement
- Component properties panel
- Screen layout presets for different viewport sizes
- CSV column binding via UI

When the designer is saved, the entire config replaces `columnMapping`.

---

## 2. Native jsPsych Plugins

Standard `@jspsych/*` plugins loaded from CDN unpkg. No custom code — just parameter mapping through the `ParameterMapper` UI.

### How Parameters are Loaded

1. Plugin metadata JSON files are stored in `server/metadata/` (one `.json` file per plugin)
2. On plugin selection, metadata is fetched via `GET /api/metadata/{pluginName}.json`
3. Parameters are displayed using `ParameterMapper` component
4. Each parameter can be mapped to:
   - A CSV column (if CSV is loaded)
   - A typed value (direct input)
   - Left at default

### Supported Plugin Versions

Defined in `server/utils/plugin-scripts.js::PLUGIN_VERSIONS`. Notable plugins with non-default versions:
- `plugin-cloze`: 2.2.0
- `plugin-survey`: 4.0.0
- `extension-webgazer`: 1.2.0
- `plugin-webgazer-*`: 2.1.0
- `plugin-virtual-chinrest`: 3.1.0
- Default for others: 2.1.0

### CDN Resolution

`getPluginScripts(pluginNames)` resolves plugin names to CDN URLs:
- `@jspsych/plugin-xxx` → `https://unpkg.com/@jspsych/plugin-xxx@VERSION`
- Webgazer-dependent plugins also inject `webgazer.js` from CDN
- Survey plugins inject `survey.css`
- `plugin-dynamic` is skipped (served locally)
- Preload plugin injected when media files exist
- Fullscreen plugin injected when `fullScreen` mode is on

---

## 3. Custom User Plugins

Users can create/upload their own jsPsych plugins through the UI. This enables fully custom trial types beyond the built-in and native plugins.

### Plugin Data Structure

```typescript
type CustomPlugin = {
  index: number;         // Plugin slot index (0, 1, 2...)
  name: string;          // Plugin name (for metadata filename and trial.plugin reference)
  scripTag: string;      // Path to plugin JS file (e.g., "/plugins/myplugin.js")
  pluginCode: string;    // Full plugin source code (JavaScript)
};
```

### PluginEditor Component (`components/PluginEditor.tsx`)

The UI for editing custom plugins uses Monaco Editor with full JavaScript support:

**Features:**
- **Upload JS file**: Upload an existing `.js` plugin file → extracts name and code
- **Name editing**: Inline text input for the plugin name (updates `scripTag` automatically to `/plugins/{name}.js`)
- **Code editor**: Monaco Editor with JavaScript syntax highlighting, autocomplete, minimap, code folding, bracket colorization
- **Auto-save**: 3-second debounce after code/name changes → saves via `PluginsProvider`
- **Delete**: Removes plugin from backend, DB, filesystem, and HTML templates → reloads window

**Upload behavior:**
- If uploaded file name matches selected plugin → overwrites that plugin
- If name doesn't exist in plugins array → replaces current plugin slot
- If name already exists in another slot → creates new plugin with "copy" suffix

**Context integration:**
- Reads/writes via `PluginsContext` (provided by `PluginsProvider`)
- On upload/change, if a trial is selected and uses this plugin, updates `trial.plugin` to the new name

### PluginsProvider (`providers/PluginsProvider.tsx`)

Manages the custom plugins state with auto-persistence:

```typescript
// State exposed through PluginsContext
{
  plugins: Plugin[];           // All custom plugins
  setPlugins: (plugins) => void;
  isPluginEditor: boolean;     // Whether PluginEditor is active
  setIsPluginEditor: (v) => void;
  isSaving: boolean;           // Save in progress
  metadataError: string;       // Error from metadata extraction
}
```

**Auto-save flow:**
1. Plugins state changes → debounce 1 second
2. Saves ALL plugins in parallel: `POST /api/save-plugin/:index` for each
3. Checks results for `metadataStatus === "error"` → sets `metadataError`
4. On success → updates `initialPlugins` baseline

### Plugin Lifecycle

1. User creates/edits plugin code in PluginEditor
2. `setPlugins()` updates the plugins array in context
3. `PluginsProvider` detects change → debounce → auto-saves all plugins:
   - `POST /api/save-plugin/:index` with `{ name, scripTag, pluginCode }`
4. Server-side (`routes/plugins.js`):
   - Saves plugin data to `db.data.pluginConfigs[0].plugins[i]`
   - Writes JS file to `userDataRoot/plugins/{filename}`
   - Updates templates: injects `<script id="plugin-script-{index}" src="...">` into both HTML templates
   - Runs metadata cleanup: removes old metadata JSON, deletes old plugin file if name/script changed
   - Runs `extract-metadata.mjs` via `spawn("node", ["extract-metadata.mjs"])` to regenerate parameter metadata
5. On success: plugin appears in the builder's plugin sidebar
6. Delete: `DELETE /api/delete-plugin/:index`
   - Removes from DB (`pluginConfigs[0].plugins`), file system (`/plugins/{filename}`), metadata JSON, and template `<script>` tags

### Template Injection

Both `experiment_template.html` and `trials_preview_template.html` get `<script>` tags for each custom plugin after save/delete:
```html
<script src="plugins/my-custom-plugin.js" id="plugin-script-0"></script>
<script src="plugins/another-plugin.js" id="plugin-script-1"></script>
```

This ensures custom plugins are available when running experiments locally.

### Metadata Extraction

After saving a plugin, `extract-metadata.mjs` (located in `userDataRoot/`) runs to parse the plugin code and extract parameter definitions. The extracted metadata is saved as `server/metadata/{pluginName}.json`. This JSON is then used by `ParameterMapper` to render the plugin's parameters in the trial configuration UI.

**Requirements for custom plugins to work:**
- Must follow jsPsych plugin spec (implement `info` with parameter definitions and `trial()` method)
- Plugin name in code must match the saved name
- Parameter types must be jsPsych `ParameterType` values
- The generated metadata JSON must include `parameters` array with `label`, `key`, `type`, `default` fields

### How to create a custom plugin (user perspective)

1. Open the builder → select "New plugin" from the plugin list
2. Write or upload the plugin JavaScript code in the Monaco editor
3. The plugin must export/register as a jsPsych plugin with `jsPsych.plugins['plugin-name'] = class { ... }`
4. Define `info` with `name`, `version`, `parameters`, and `data` fields
5. Implement the `trial(display_element, trial)` method
6. After saving, the plugin appears in the plugin list and can be used in trials
7. Use the trial's `ParameterMapper` to configure the plugin's custom parameters

---

## Plugin Selection Flow in UI

1. User drags a plugin from the sidebar to the Timeline
2. `createTrial()` is called with the plugin name
3. The trial appears in the timeline
4. When selected, `TrialsConfig` renders:
   - For `plugin-dynamic`: `TabContent` → `TrialDesigner` (Components tab) + `ParameterMapper` (General Settings tab)
   - For other plugins: `ParameterMapper` with the plugin's parameters
   - For `webgazer`: `Webgazer` component with 4-phase configuration

---

## Extensions

jsPsych extensions (`extension-webgazer`, `extension-mouse-tracking`, `extension-record-video`) are configured per-trial via:
- `parameters.includesExtensions`: boolean toggle
- `parameters.extensionType`: the extension name

The `ExtensionsConfig` component renders when the plugin supports extensions.

---

## WebGazer Special Plugin

WebGazer is a multi-phase trial combining 4 plugins:
1. `plugin-webgazer-init-camera` - Camera initialization
2. `plugin-webgazer-calibrate` - Calibration phase
3. `plugin-webgazer-validate` - Validation phase
4. `plugin-webgazer-recalibrate` - Recalibration with minimum percent threshold

Each phase has its own:
- Instructions toggled via `include_instructions` per phase
- Plugin parameters mapped via `ParameterMapper`
- Generated trial code (phases are concatenated into one `trialCode`)

The `trialCode` for WebGazer **is** saved to the database (unlike other plugins where code is generated on demand).
