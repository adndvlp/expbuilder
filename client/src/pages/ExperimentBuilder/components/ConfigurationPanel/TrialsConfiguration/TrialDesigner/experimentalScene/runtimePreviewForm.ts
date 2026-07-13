import {
  applyPreviewPosition,
  resolvePreviewParam,
  type RenderContext,
} from "./runtimePreviewShared";

export function renderPreviewInputComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const clozeContainer = document.createElement("div");
  clozeContainer.style.width = "max-content";
  applyPreviewPosition(clozeContainer, config, context);

  const text = String(resolvePreviewParam(config.text, ""));
  const parts = text.split("%");
  const inputCount = Math.max(
    1,
    parts.length >= 3 ? Math.floor(parts.length / 2) : 0,
  );
  const fontSize = resolvePreviewParam(config.input_font_size, 14);
  const placeholder = resolvePreviewParam(config.placeholder, "");

  for (let index = 0; index < inputCount; index++) {
    const input = document.createElement("input");
    input.type = String(resolvePreviewParam(config.input_type, "text"));
    input.id = `input${index}`;
    input.classList.add("jspsych-input-response");
    input.value = "";
    if (placeholder) input.placeholder = placeholder;
    input.style.fontSize = `${fontSize}px`;
    input.style.color = resolvePreviewParam(config.input_font_color, "#000000");
    input.style.fontFamily = resolvePreviewParam(
      config.input_font_family,
      "sans-serif",
    );
    input.style.backgroundColor = resolvePreviewParam(
      config.input_background_color,
      "#ffffff",
    );
    input.style.border = `${resolvePreviewParam(config.input_border_width, 1)}px solid ${resolvePreviewParam(config.input_border_color, "#888888")}`;
    input.style.borderRadius = `${resolvePreviewParam(config.input_border_radius, 2)}px`;
    input.style.padding = resolvePreviewParam(config.input_padding, "4px 6px");
    if (Number(config.__preview_width) > 0) {
      input.style.width = `${config.__preview_width}px`;
    }
    if (Number(config.__preview_height) > 0) {
      input.style.height = `${config.__preview_height}px`;
    }
    input.style.boxSizing = "border-box";
    input.style.display = "block";
    clozeContainer.appendChild(input);
  }

  container.appendChild(clozeContainer);
  return clozeContainer;
}

export function renderPreviewSliderComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const width = Number(resolvePreviewParam(config.__preview_width, 300));
  const height = Number(resolvePreviewParam(config.__preview_height, 120));
  const min = Number(resolvePreviewParam(config.min, 0));
  const max = Number(resolvePreviewParam(config.max, 100));
  const value = Number(resolvePreviewParam(config.slider_start, 50));
  const labelsRaw: unknown = resolvePreviewParam(config.labels, []);
  const labels: string[] = Array.isArray(labelsRaw)
    ? labelsRaw.map((label: unknown) => String(label))
    : typeof labelsRaw === "string"
      ? labelsRaw.split(",").map((label: string) => label.trim())
      : [];
  const padding = Math.max(10, Math.min(40, width * 0.14));
  const trackX = padding;
  const trackY = height * 0.4;
  const trackWidth = Math.max(1, width - padding * 2);
  const thumbRadius = Math.max(5, Math.min(10, height * 0.07));

  const sliderContainer = document.createElement("div");
  sliderContainer.classList.add("jspsych-slider-response-container");
  sliderContainer.style.width = `${width}px`;
  sliderContainer.style.height = `${height}px`;
  sliderContainer.style.position = "relative";
  sliderContainer.style.margin = "0";
  sliderContainer.style.background = "transparent";
  sliderContainer.style.pointerEvents = "auto";
  sliderContainer.style.boxSizing = "border-box";
  applyPreviewPosition(sliderContainer, config, context);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "jspsych-slider";
  slider.id = "jspsych-slider-response-component";
  slider.value = String(value);
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(resolvePreviewParam(config.step, 1));
  slider.style.position = "absolute";
  slider.style.left = `${trackX}px`;
  slider.style.top = `${trackY - thumbRadius * 2}px`;
  slider.style.width = `${trackWidth}px`;
  slider.style.height = `${thumbRadius * 4}px`;
  slider.style.margin = "0";
  slider.style.padding = "0";
  slider.style.opacity = "1";
  slider.style.cursor = "pointer";
  slider.style.pointerEvents = "auto";
  slider.style.accentColor = "#9333ea";
  sliderContainer.appendChild(slider);

  if (labels.length >= 2) {
    const labelsElement = document.createElement("div");
    labelsElement.style.position = "absolute";
    labelsElement.style.left = `${trackX}px`;
    labelsElement.style.top = `${trackY + thumbRadius * 2 + 6}px`;
    labelsElement.style.width = `${trackWidth}px`;
    labelsElement.style.display = "flex";
    labelsElement.style.justifyContent = "space-between";
    labelsElement.style.fontSize = "12px";
    labelsElement.style.color = "#6b21a8";
    labelsElement.style.pointerEvents = "none";
    labels.forEach((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      labelsElement.appendChild(span);
    });
    sliderContainer.appendChild(labelsElement);
  }

  if (Boolean(resolvePreviewParam(config.require_movement, false))) {
    const note = document.createElement("div");
    note.textContent = "movement required";
    note.style.position = "absolute";
    note.style.left = "0";
    note.style.right = "0";
    note.style.bottom = "0";
    note.style.fontSize = "11px";
    note.style.fontStyle = "italic";
    note.style.color = "#9333ea";
    note.style.textAlign = "center";
    note.style.pointerEvents = "none";
    sliderContainer.appendChild(note);
  }

  container.appendChild(sliderContainer);
  return sliderContainer;
}

export function renderPreviewSurveyContainer(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const surveyContainer = document.createElement("div");
  surveyContainer.id = "jspsych-survey-surveyjs-container";
  surveyContainer.style.maxHeight = "90vh";
  surveyContainer.style.overflowY = "auto";
  surveyContainer.style.overflowX = "hidden";
  applyPreviewPosition(surveyContainer, config, context);

  const innerContainer = document.createElement("div");
  innerContainer.classList.add("jspsych-survey-container");
  innerContainer.style.textAlign = "initial";
  innerContainer.style.minWidth = resolvePreviewParam(
    config.min_width,
    "min(100vw, 800px)",
  );
  innerContainer.style.overflowY = "auto";
  innerContainer.style.overflowX = "auto";
  surveyContainer.appendChild(innerContainer);

  container.appendChild(surveyContainer);
  return {
    element: surveyContainer,
    surveyHost: innerContainer,
  };
}

export function renderPreviewFileUploadComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const uploadContainer = document.createElement("div");
  uploadContainer.style.cssText = [
    "display: flex;",
    "flex-direction: column;",
    "align-items: center;",
    "gap: 10px;",
  ].join(" ");
  applyPreviewPosition(uploadContainer, config, context);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = `jspsych-file-upload-input-preview`;
  fileInput.style.display = "none";
  const accept = resolvePreviewParam(config.accept, "");
  if (accept) {
    fileInput.accept = String(accept)
      .split(",")
      .map((ext) => {
        const trimmed = ext.trim();
        if (trimmed && !trimmed.startsWith(".") && !trimmed.includes("/")) {
          return `.${trimmed}`;
        }
        return trimmed;
      })
      .join(",");
  }
  if (resolvePreviewParam(config.multiple, false)) fileInput.multiple = true;

  const triggerButton = document.createElement("button");
  triggerButton.className = "jspsych-btn";
  triggerButton.textContent = resolvePreviewParam(
    config.button_label,
    "Upload File",
  );
  triggerButton.addEventListener("click", () => fileInput.click());

  const previewContainer = document.createElement("div");
  previewContainer.style.cssText =
    "display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;";

  const statusText = document.createElement("p");
  statusText.style.cssText = "margin: 0; font-size: 13px; color: #555;";

  uploadContainer.appendChild(fileInput);
  uploadContainer.appendChild(triggerButton);
  uploadContainer.appendChild(previewContainer);
  uploadContainer.appendChild(statusText);
  container.appendChild(uploadContainer);

  return uploadContainer;
}
