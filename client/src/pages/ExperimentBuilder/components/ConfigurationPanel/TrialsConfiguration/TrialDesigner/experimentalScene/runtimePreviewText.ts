import {
  applyPreviewPosition,
  resolvePreviewParam,
  type RenderContext,
} from "./runtimePreviewShared";
import {
  createPreviewTextLayout,
  drawPreviewTextLayout,
} from "./runtimePreviewTextLayout";

export function renderPreviewTextComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const text = String(resolvePreviewParam(config.text, "Text"));
  const parts = text.split("%");
  const isCloze = parts.length >= 3 && parts.length % 2 === 1;

  if (isCloze) {
    const element = document.createElement("div");
    element.id = config.name
      ? `jspsych-text-component-${config.name}`
      : "jspsych-text-component";
    applyPreviewPosition(element, config, context);
    element.style.color = resolvePreviewParam(config.font_color, "#000000");
    element.style.fontSize = `${resolvePreviewParam(config.font_size, 16)}px`;
    element.style.fontFamily = resolvePreviewParam(
      config.font_family,
      "sans-serif",
    );
    element.style.fontWeight = String(
      resolvePreviewParam(config.font_weight, "normal"),
    );
    element.style.fontStyle = resolvePreviewParam(config.font_style, "normal");
    element.style.textAlign = resolvePreviewParam(config.text_align, "center");
    element.style.lineHeight = String(
      resolvePreviewParam(config.line_height, 1.5),
    );
    element.style.backgroundColor = resolvePreviewParam(
      config.background_color,
      "transparent",
    );
    element.style.padding = resolvePreviewParam(config.padding, "0px");
    element.style.borderRadius = `${resolvePreviewParam(config.border_radius, 0)}px`;
    const borderWidth = Number(resolvePreviewParam(config.border_width, 0));
    element.style.border =
      borderWidth > 0
        ? `${borderWidth}px solid ${resolvePreviewParam(config.border_color, "transparent")}`
        : "none";
    element.style.width =
      Number(config.__preview_width) > 0
        ? `${config.__preview_width}px`
        : "max-content";
    element.style.boxSizing = "border-box";
    element.style.whiteSpace = "nowrap";

    let html = "";
    let solutionCounter = 0;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        html += parts[i];
      } else {
        html += `<input type="text" id="input${solutionCounter}" value="" style="display:inline;font:inherit;color:inherit;vertical-align:baseline;width:10ch;box-sizing:content-box;">`;
        solutionCounter++;
      }
    }

    element.innerHTML = html;
    container.appendChild(element);
    return element;
  }

  const sizingCanvas = document.createElement("canvas");
  const sizingContext = sizingCanvas.getContext("2d");
  if (!sizingContext) {
    const fallback = document.createElement("div");
    fallback.textContent = text;
    applyPreviewPosition(fallback, config, context);
    container.appendChild(fallback);
    return fallback;
  }

  const layout = createPreviewTextLayout(sizingContext, config);
  const wrapper = document.createElement("div");
  wrapper.id = config.name
    ? `jspsych-text-component-${config.name}`
    : "jspsych-text-component";
  wrapper.className = "dynamic-text-component";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.width = `${layout.width}px`;
  wrapper.style.height = `${layout.height}px`;
  wrapper.style.margin = "0";
  wrapper.style.padding = "0";
  wrapper.style.background = "transparent";
  wrapper.style.pointerEvents = "none";
  wrapper.style.visibility = "visible";
  applyPreviewPosition(wrapper, config, context);

  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(layout.width * dpr));
  canvas.height = Math.max(1, Math.round(layout.height * dpr));
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);
    drawPreviewTextLayout(ctx, layout);
  }

  wrapper.appendChild(canvas);
  container.appendChild(wrapper);
  return wrapper;
}
