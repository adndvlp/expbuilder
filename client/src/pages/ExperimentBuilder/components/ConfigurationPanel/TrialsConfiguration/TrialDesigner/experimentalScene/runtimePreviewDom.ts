import React from "react";
import { createRoot } from "react-dom/client";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import { CanvasStyles, TrialComponent } from "../types";

type CoordinateMode = "canvas" | "none";

type RenderContext = {
  coordinateMode?: CoordinateMode;
  canvasStyles?: {
    width?: number;
    height?: number;
  };
};

type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type TextLayout = {
  width: number;
  height: number;
  rotation: number;
  lines: string[];
  font: string;
  fontColor: string;
  textAlign: CanvasTextAlign;
  lineHeightPx: number;
  padding: Padding;
  backgroundColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
};

export function resolvePreviewParam<T = any>(raw: any, fallback: T): T {
  if (raw === undefined || raw === null) return fallback;
  if (
    typeof raw === "object" &&
    "value" in raw &&
    (raw.source === "typed" || raw.source === "csv")
  ) {
    return raw.value !== undefined && raw.value !== null
      ? (raw.value as T)
      : fallback;
  }
  return raw as T;
}

function applyPreviewPosition(
  element: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const mode = context.coordinateMode ?? "none";
  element.style.zIndex = String(resolvePreviewParam(config.zIndex, 0));

  if (mode === "none") {
    element.style.position = "relative";
    element.style.left = "";
    element.style.top = "";
    element.style.transform = "";
    return;
  }

  element.style.position = "absolute";
  element.style.transform = "translate(-50%, -50%)";

  const coordinates = resolvePreviewParam(config.coordinates, { x: 0, y: 0 });
  const x = Number(coordinates?.x ?? 0);
  const y = Number(coordinates?.y ?? 0);
  const width = Number(context.canvasStyles?.width ?? 1024);
  const height = Number(context.canvasStyles?.height ?? 768);
  element.style.left = `${width / 2 + (x / 100) * (width / 2)}px`;
  element.style.top = `${height / 2 - (y / 100) * (height / 2)}px`;
}

export function renderPreviewHtmlComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const stimulusElement = document.createElement("div");
  stimulusElement.id = config.name
    ? `jspsych-dynamic-${config.name}-stimulus`
    : "jspsych-dynamic-html-stimulus";
  stimulusElement.className = "dynamic-html-component-stimulus";
  stimulusElement.style.width = "max-content";
  applyPreviewPosition(stimulusElement, config, context);
  stimulusElement.innerHTML = makeGrapesHtmlPortable(
    resolvePreviewParam(config.stimulus, ""),
  );
  container.appendChild(stimulusElement);
  return stimulusElement;
}

function getImageSourceSize(source: HTMLImageElement) {
  return {
    width: source.naturalWidth || source.width,
    height: source.naturalHeight || source.height,
  };
}

export function renderPreviewImageComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const wrapper = document.createElement("div");
  wrapper.id = config.name
    ? `jspsych-dynamic-${config.name}-stimulus`
    : "jspsych-dynamic-image-stimulus";
  wrapper.className = "dynamic-image-component";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.margin = "0";
  wrapper.style.padding = "0";
  wrapper.style.background = "transparent";
  wrapper.style.pointerEvents = "none";
  wrapper.style.visibility = "visible";
  applyPreviewPosition(wrapper, config, context);

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  wrapper.appendChild(canvas);
  container.appendChild(wrapper);

  const stimulus = String(resolvePreviewParam(config.stimulus, ""));
  const image = new Image();
  image.draggable = false;

  const draw = () => {
    const sourceSize = getImageSourceSize(image);
    if (sourceSize.width <= 0 || sourceSize.height <= 0) return;

    const maintainAspectRatio = Boolean(
      resolvePreviewParam(config.maintain_aspect_ratio, true),
    );
    const configuredWidth = Number(resolvePreviewParam(config.__preview_width, 0));
    const configuredHeight = Number(resolvePreviewParam(config.__preview_height, 0));

    let drawWidth = sourceSize.width;
    let drawHeight = sourceSize.height;

    if (configuredWidth > 1) {
      drawWidth = configuredWidth;
      if (!(configuredHeight > 1) && maintainAspectRatio) {
        drawHeight = sourceSize.height * (drawWidth / sourceSize.width);
      }
    }

    if (configuredHeight > 1) {
      drawHeight = configuredHeight;
      if (!(configuredWidth > 1) && maintainAspectRatio) {
        drawWidth = sourceSize.width * (drawHeight / sourceSize.height);
      }
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(drawWidth * dpr));
    canvas.height = Math.max(1, Math.round(drawHeight * dpr));
    canvas.style.width = `${drawWidth}px`;
    canvas.style.height = `${drawHeight}px`;
    wrapper.style.width = `${drawWidth}px`;
    wrapper.style.height = `${drawHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawWidth, drawHeight);
    ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
  };

  image.onload = draw;
  image.src = stimulus;
  if (image.complete) draw();

  return wrapper;
}

export function renderPreviewVideoComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const stimulusWrapper = document.createElement("div");
  stimulusWrapper.id = "jspsych-dynamic-video-component-wrapper";
  stimulusWrapper.className = "dynamic-video-component-wrapper";
  stimulusWrapper.style.width = "max-content";
  stimulusWrapper.style.height = "auto";
  applyPreviewPosition(stimulusWrapper, config, context);
  container.appendChild(stimulusWrapper);

  const videoElement = document.createElement("video");
  stimulusWrapper.appendChild(videoElement);
  videoElement.id = config.name
    ? `jspsych-dynamic-${config.name}-stimulus`
    : "jspsych-dynamic-video-stimulus";
  videoElement.className = "dynamic-video-component";
  videoElement.setAttribute("playsinline", "");
  videoElement.controls = Boolean(resolvePreviewParam(config.controls, false));
  videoElement.muted = true;
  videoElement.preload = "metadata";
  videoElement.playbackRate = Number(resolvePreviewParam(config.rate, 1)) || 1;

  const width = Number(resolvePreviewParam(config.__preview_width, 0));
  const height = Number(resolvePreviewParam(config.__preview_height, 0));
  if (width > 1) videoElement.style.width = `${width}px`;
  if (height > 1) videoElement.style.height = `${height}px`;
  if (width > 1 && !(height > 1)) {
    videoElement.style.height = "auto";
  } else if (height > 1 && !(width > 1)) {
    videoElement.style.width = "auto";
  }

  const stimuliRaw = resolvePreviewParam(config.stimulus, []);
  const stimuli = Array.isArray(stimuliRaw)
    ? stimuliRaw.map((item: unknown) => String(item))
    : [String(stimuliRaw)].filter(Boolean);

  stimuli.forEach((source) => {
    const filename = source.includes("?") ? source.slice(0, source.indexOf("?")) : source;
    const type = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
    const sourceElement = document.createElement("source");
    sourceElement.src = source;
    sourceElement.type = type ? `video/${type}` : "";
    videoElement.appendChild(sourceElement);
  });

  return stimulusWrapper;
}

function parseCssPx(raw: string | number | null | undefined): number {
  /* v8 ignore start -- callers normalize padding values to string parts before parsing. */
  if (raw === null || raw === undefined) return 0;
  /* v8 ignore stop */
  /* v8 ignore start -- retained for defensive direct calls; current callers pass strings. */
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  /* v8 ignore stop */
  const match = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function parsePadding(raw: any, fallback: string): Padding {
  const value = String(resolvePreviewParam(raw, fallback)).trim();
  const parts = value.split(/\s+/).map((part) => parseCssPx(part));
  const [top = 0, right = top, bottom = top, left = right] =
    parts.length === 1
      ? [parts[0], parts[0], parts[0], parts[0]]
      : parts.length === 2
        ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3
          ? [parts[0], parts[1], parts[2], parts[1]]
          : [parts[0], parts[1], parts[2], parts[3]];

  return { top, right, bottom, left };
}

function isTransparent(color: string | null | undefined): boolean {
  if (!color) return true;
  const normalized = String(color).trim().toLowerCase();
  return (
    normalized === "transparent" ||
    normalized === "none" ||
    normalized === "rgba(0,0,0,0)" ||
    normalized === "rgba(0, 0, 0, 0)"
  );
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
): string[] {
  if (!line) return [""];
  if (!maxWidth || ctx.measureText(line).width <= maxWidth) return [line];

  const words = line.split(/(\s+)/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current + word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current.trimEnd());
      current = word.trimStart();
    } else {
      current = next;
    }
  }

  if (current) lines.push(current.trimEnd());
  return lines;
}

function createPreviewTextLayout(
  ctx: CanvasRenderingContext2D,
  config: any,
): TextLayout {
  const text = String(resolvePreviewParam(config.text, "Text"));
  const fontSizeVw = resolvePreviewParam<number | null>(
    config._font_size_runtime_vw,
    null,
  );
  const configuredFontSize = resolvePreviewParam<number | undefined>(
    config.font_size,
    undefined,
  );
  const previewWidth = Number(resolvePreviewParam(config.__preview_width, 0));
  const canvasWidth = Number(
    resolvePreviewParam(config.__canvas_width, previewWidth || 1024),
  );
  const fontSize =
    configuredFontSize != null
      ? Number(configuredFontSize)
      : fontSizeVw != null
        ? (Number(fontSizeVw) / 100) * canvasWidth
        : 16;
  const fontFamily = resolvePreviewParam(config.font_family, "sans-serif");
  const fontWeight = resolvePreviewParam(config.font_weight, "normal");
  const fontStyle = resolvePreviewParam(config.font_style, "normal");
  const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  const lineHeight = Number(resolvePreviewParam(config.line_height, 1.5));
  const lineHeightPx = Math.max(1, fontSize * lineHeight);
  const padding = parsePadding(config.padding, "0px");
  const maxBlockWidth = Math.max(1, previewWidth || Math.max(200, canvasWidth * 0.86));
  const maxTextWidth = Math.max(1, maxBlockWidth - padding.left - padding.right);

  ctx.save();
  ctx.font = font;
  const lines = text
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(ctx, line, maxTextWidth));
  const measuredTextWidth = Math.max(
    1,
    ...lines.map((line) => ctx.measureText(line).width),
  );
  ctx.restore();

  const blockWidth = previewWidth || measuredTextWidth + padding.left + padding.right;
  const blockHeight =
    lines.length * lineHeightPx + padding.top + padding.bottom;

  return {
    width: blockWidth,
    height: blockHeight,
    rotation: Number(resolvePreviewParam(config.rotation, 0)),
    lines,
    font,
    fontColor: resolvePreviewParam(config.font_color, "#000000"),
    textAlign: resolvePreviewParam(config.text_align, "center") as CanvasTextAlign,
    lineHeightPx,
    padding,
    backgroundColor: resolvePreviewParam(config.background_color, "transparent"),
    borderRadius: Number(resolvePreviewParam(config.border_radius, 0)),
    borderColor: resolvePreviewParam(config.border_color, "transparent"),
    borderWidth: Number(resolvePreviewParam(config.border_width, 0)),
  };
}

function drawPreviewTextLayout(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
) {
  const originX = -layout.width / 2;
  const originY = -layout.height / 2;

  ctx.save();
  ctx.translate(layout.width / 2, layout.height / 2);
  ctx.rotate((layout.rotation * Math.PI) / 180);

  if (!isTransparent(layout.backgroundColor)) {
    ctx.fillStyle = layout.backgroundColor;
    roundedRectPath(
      ctx,
      originX,
      originY,
      layout.width,
      layout.height,
      layout.borderRadius,
    );
    ctx.fill();
  }

  if (layout.borderWidth > 0 && !isTransparent(layout.borderColor)) {
    ctx.strokeStyle = layout.borderColor;
    ctx.lineWidth = layout.borderWidth;
    roundedRectPath(
      ctx,
      originX + layout.borderWidth / 2,
      originY + layout.borderWidth / 2,
      layout.width - layout.borderWidth,
      layout.height - layout.borderWidth,
      layout.borderRadius,
    );
    ctx.stroke();
  }

  ctx.font = layout.font;
  ctx.fillStyle = layout.fontColor;
  ctx.textAlign = layout.textAlign;
  ctx.textBaseline = "middle";

  const textX =
    layout.textAlign === "left"
      ? originX + layout.padding.left
      : layout.textAlign === "right"
        ? originX + layout.width - layout.padding.right
        : 0;
  const firstLineY = originY + layout.padding.top + layout.lineHeightPx / 2;

  layout.lines.forEach((line, index) => {
    ctx.fillText(line, textX, firstLineY + index * layout.lineHeightPx);
  });

  ctx.restore();
}

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
    element.style.fontFamily = resolvePreviewParam(config.font_family, "sans-serif");
    element.style.fontWeight = String(resolvePreviewParam(config.font_weight, "normal"));
    element.style.fontStyle = resolvePreviewParam(config.font_style, "normal");
    element.style.textAlign = resolvePreviewParam(config.text_align, "center");
    element.style.lineHeight = String(resolvePreviewParam(config.line_height, 1.5));
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
      Number(config.__preview_width) > 0 ? `${config.__preview_width}px` : "max-content";
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

function isImageUrl(value: string): boolean {
  /* v8 ignore start -- choice normalization filters empty values before image detection. */
  if (!value) return false;
  /* v8 ignore stop */
  try {
    const url = new URL(value);
    return /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i.test(url.pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(value.toLowerCase());
  }
}

function splitPreviewChoice(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed.includes(",")
    ? trimmed
        .split(",")
        .map((choice) => choice.trim())
        .filter(Boolean)
    : [trimmed];
}

function normalizePreviewChoices(value: unknown) {
  const choices = Array.isArray(value)
    ? value.flatMap((choice) => splitPreviewChoice(String(choice)))
    : splitPreviewChoice(String(value));

  return choices.length > 0 ? choices : ["Button"];
}

export function renderPreviewButtonComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const choicesRaw = resolvePreviewParam(config.choices, ["Button"]);
  const choices = normalizePreviewChoices(choicesRaw);
  const rows = Math.max(1, Number(resolvePreviewParam(config.grid_rows, 1)) || 1);
  const configuredColumns = Number(resolvePreviewParam(config.grid_columns, 0));
  const columns =
    Number.isFinite(configuredColumns) && configuredColumns > 0
      ? Math.max(1, configuredColumns)
      : Math.max(1, Math.ceil(choices.length / rows));
  const padding = parsePadding(config.button_padding, "6px 14px");
  const fontSize = Number(resolvePreviewParam(config.button_font_size, 14));
  const imageButtonWidth = Number(resolvePreviewParam(config.image_button_width, 150));
  const imageButtonHeight = Number(resolvePreviewParam(config.image_button_height, 150));
  const imageSources = new Map<string, HTMLImageElement>();
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (measureContext) measureContext.font = `${fontSize}px sans-serif`;
  const naturalButtonWidth = Math.max(
    80,
    ...choices.map((choice) =>
      isImageUrl(choice)
        ? imageButtonWidth + padding.left + padding.right + 10
        : (measureContext?.measureText(choice).width ?? choice.length * fontSize * 0.55) +
          padding.left +
          padding.right +
          2,
    ),
  );
  const naturalButtonHeight = Math.max(
    34,
    fontSize * 1.4 + padding.top + padding.bottom,
    ...choices
      .filter((choice) => isImageUrl(choice))
      .map(() => imageButtonHeight + padding.top + padding.bottom + 10),
  );
  const width = Number(
    resolvePreviewParam(config.__preview_width, naturalButtonWidth * columns),
  );
  const height = Number(
    resolvePreviewParam(config.__preview_height, naturalButtonHeight * rows),
  );
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  const buttonGroup = document.createElement("div");
  buttonGroup.id = "jspsych-button-response-component-btngroup";
  buttonGroup.className = "jspsych-button-response-container";
  buttonGroup.style.width = `${width}px`;
  buttonGroup.style.height = `${height}px`;
  buttonGroup.style.position = "relative";
  buttonGroup.style.background = "transparent";
  buttonGroup.style.pointerEvents = "auto";
  buttonGroup.style.boxSizing = "border-box";
  applyPreviewPosition(buttonGroup, config, context);

  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  buttonGroup.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const drawButtons = () => {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    choices.forEach((choice, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const inset = 2;
      const x = col * cellWidth + inset;
      const y = row * cellHeight + inset;
      const w = Math.max(1, cellWidth - inset * 2);
      const h = Math.max(1, cellHeight - inset * 2);
      const borderWidth = Number(resolvePreviewParam(config.button_border_width, 1));
      const borderColor = resolvePreviewParam(config.button_border_color, "#999999");

      ctx.fillStyle = resolvePreviewParam(config.button_color, "#e7e7e7");
      roundedRectPath(
        ctx,
        x,
        y,
        w,
        h,
        Number(resolvePreviewParam(config.button_border_radius, 3)),
      );
      ctx.fill();

      if (borderWidth > 0 && !isTransparent(borderColor)) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        roundedRectPath(
          ctx,
          x + borderWidth / 2,
          y + borderWidth / 2,
          w - borderWidth,
          h - borderWidth,
          Number(resolvePreviewParam(config.button_border_radius, 3)),
        );
        ctx.stroke();
      }

      if (isImageUrl(choice)) {
        const source = imageSources.get(choice);
        if (source && source.naturalWidth > 0 && source.naturalHeight > 0) {
          const maxWidth = Math.min(
            imageButtonWidth,
            w - padding.left - padding.right,
          );
          const maxHeight = Math.min(
            imageButtonHeight,
            h - padding.top - padding.bottom,
          );
          const scale = Math.min(
            maxWidth / source.naturalWidth,
            maxHeight / source.naturalHeight,
            1,
          );
          const imageWidth = source.naturalWidth * scale;
          const imageHeight = source.naturalHeight * scale;
          ctx.drawImage(
            source,
            x + w / 2 - imageWidth / 2,
            y + h / 2 - imageHeight / 2,
            imageWidth,
            imageHeight,
          );
        }
      } else {
        const maxWidth = Math.max(1, w - padding.left - padding.right);
        const maxHeight = Math.max(1, h - padding.top - padding.bottom);
        let fittedFontSize = Math.max(1, Math.min(fontSize, maxHeight * 0.82));
        for (let attempt = 0; attempt < 8; attempt += 1) {
          ctx.font = `${fittedFontSize}px sans-serif`;
          const measuredWidth = ctx.measureText(choice).width;
          if (measuredWidth <= maxWidth || fittedFontSize <= 4) break;
          fittedFontSize *= Math.max(0.5, maxWidth / Math.max(1, measuredWidth));
        }
        ctx.font = `${Math.max(1, fittedFontSize)}px sans-serif`;
        ctx.fillStyle = resolvePreviewParam(config.button_text_color, "#000000");
        ctx.fillText(
          choice,
          x + w / 2,
          y + h / 2,
          maxWidth,
        );
      }
    });
  };

  choices.forEach((choice, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.choice = choice;
    button.setAttribute("aria-label", choice);
    button.style.position = "absolute";
    button.style.left = `${col * cellWidth}px`;
    button.style.top = `${row * cellHeight}px`;
    button.style.width = `${cellWidth}px`;
    button.style.height = `${cellHeight}px`;
    button.style.margin = "0";
    button.style.padding = "0";
    button.style.border = "0";
    button.style.background = "transparent";
    button.style.color = "transparent";
    button.style.opacity = "0";
    button.style.cursor = "pointer";
    button.style.pointerEvents = "auto";
    buttonGroup.appendChild(button);

    if (isImageUrl(choice) && !imageSources.has(choice)) {
      const image = new Image();
      image.onload = drawButtons;
      image.src = choice;
      imageSources.set(choice, image);
    }
  });

  drawButtons();

  container.appendChild(buttonGroup);
  return buttonGroup;
}

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
  const inputCount = Math.max(1, parts.length >= 3 ? Math.floor(parts.length / 2) : 0);
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
    input.style.fontFamily = resolvePreviewParam(config.input_font_family, "sans-serif");
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
  triggerButton.textContent = resolvePreviewParam(config.button_label, "Upload File");
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

function getSketchpadCanvasHtml(config: any): string {
  const canvasShape = String(resolvePreviewParam(config.canvas_shape, "rectangle"));

  if (canvasShape === "rectangle") {
    return `
        <canvas id="sketchpad-canvas" 
        width="${resolvePreviewParam(config.canvas_width, 500)}" 
        height="${resolvePreviewParam(config.canvas_height, 500)}" 
        class="sketchpad-rectangle"></canvas>
      `;
  }

  if (canvasShape === "circle") {
    return `
        <canvas id="sketchpad-canvas" 
        width="${resolvePreviewParam(config.canvas_diameter, 500)}" 
        height="${resolvePreviewParam(config.canvas_diameter, 500)}" 
        class="sketchpad-circle">
        </canvas>
      `;
  }

  throw new Error(
    '`canvas_shape` parameter in sketchpad plugin must be either "rectangle" or "circle"',
  );
}

function getSketchpadControlsHtml(config: any): string {
  let sketchpadControls = `<div id="sketchpad-controls">`;
  sketchpadControls += `<div id="sketchpad-color-palette">`;
  const paletteRaw = resolvePreviewParam(config.stroke_color_palette, []);
  const palette = Array.isArray(paletteRaw) ? paletteRaw : [];

  for (const color of palette) {
    sketchpadControls += `<button class="sketchpad-color-select" data-color="${color}" style="background-color:${color};"></button>`;
  }

  sketchpadControls += `</div>`;
  sketchpadControls += `<div id="sketchpad-actions">`;

  if (resolvePreviewParam(config.show_clear_button, false)) {
    sketchpadControls += `<button class="jspsych-btn" id="sketchpad-clear" disabled>${resolvePreviewParam(config.clear_button_label, "Clear")}</button>`;
  }

  if (resolvePreviewParam(config.show_undo_button, false)) {
    sketchpadControls += `<button class="jspsych-btn" id="sketchpad-undo" disabled>${resolvePreviewParam(config.undo_button_label, "Undo")}</button>`;
    if (resolvePreviewParam(config.show_redo_button, false)) {
      sketchpadControls += `<button class="jspsych-btn" id="sketchpad-redo" disabled>${resolvePreviewParam(config.redo_button_label, "Redo")}</button>`;
    }
  }

  sketchpadControls += `</div></div>`;
  return sketchpadControls;
}

function getSketchpadDisplayHtml(config: any): string {
  const canvasHtml = getSketchpadCanvasHtml(config) + getSketchpadControlsHtml(config);
  const prompt = resolvePreviewParam(config.prompt, null);
  const promptLocation = resolvePreviewParam(config.prompt_location, "abovecanvas");

  if (prompt !== null) {
    if (promptLocation === "abovecanvas") return String(prompt) + canvasHtml;
    if (promptLocation === "belowcanvas") return canvasHtml + String(prompt);
  }

  return canvasHtml;
}

export function ensurePreviewSketchpadStyles(config: any) {
  document.querySelector("#sketchpad-styles")?.remove();

  const canvasShape = String(resolvePreviewParam(config.canvas_shape, "rectangle"));
  const canvasWidth = Number(resolvePreviewParam(config.canvas_width, 500));
  const canvasDiameter = Number(resolvePreviewParam(config.canvas_diameter, 500));
  const borderWidth = Number(resolvePreviewParam(config.canvas_border_width, 0));
  const controlsWidth =
    canvasShape === "rectangle"
      ? canvasWidth + borderWidth * 2
      : canvasDiameter + borderWidth * 2;

  document.querySelector("head")?.insertAdjacentHTML(
    "beforeend",
    `<style id="sketchpad-styles">
        #sketchpad-controls {
          line-height: 1; 
          width:${controlsWidth}px; 
          display: flex; 
          justify-content: space-between; 
          flex-wrap: wrap;
          margin: auto;
        }
        #sketchpad-color-palette { 
          display: inline-block; text-align:left; flex-grow: 1;
        }
        .sketchpad-color-select { 
          cursor: pointer; height: 33px; width: 33px; border-radius: 4px; padding: 0; border: 1px solid #ccc; 
        }
        #sketchpad-actions {
          display:inline-block; text-align:right; flex-grow: 1;
        }
        #sketchpad-actions button {
          margin-left: 4px;
        }
        #sketchpad-canvas {
          touch-action: none;
          border: ${borderWidth}px solid ${resolvePreviewParam(config.canvas_border_color, "#000000")};
        }
        .sketchpad-circle {
          border-radius: ${canvasDiameter / 2}px;
        }
      </style>`,
  );
}

function fillSketchpadBackground(
  ctx: CanvasRenderingContext2D | null,
  config: any,
) {
  if (!ctx) return;
  const canvasShape = String(resolvePreviewParam(config.canvas_shape, "rectangle"));
  const canvasWidth = Number(resolvePreviewParam(config.canvas_width, 500));
  const canvasHeight = Number(resolvePreviewParam(config.canvas_height, 500));
  const canvasDiameter = Number(resolvePreviewParam(config.canvas_diameter, 500));

  ctx.fillStyle = resolvePreviewParam(config.background_color, "#ffffff");
  if (canvasShape === "rectangle") {
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  if (canvasShape === "circle") {
    ctx.fillRect(0, 0, canvasDiameter, canvasDiameter);
  }
}

function drawSketchpadBackgroundImage(
  ctx: CanvasRenderingContext2D | null,
  config: any,
) {
  const backgroundImage = resolvePreviewParam(config.background_image, null);
  if (!ctx || backgroundImage === null) return;

  const image = new Image();
  image.src = backgroundImage;
  image.onload = () => {
    ctx.drawImage(image, 0, 0);
  };
}

export function renderPreviewSketchpadComponent(
  container: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  ensurePreviewSketchpadStyles(config);

  const sketchpadContainer = document.createElement("div");
  sketchpadContainer.id = "jspsych-sketchpad-container";
  applyPreviewPosition(sketchpadContainer, config, context);
  container.appendChild(sketchpadContainer);

  sketchpadContainer.innerHTML = getSketchpadDisplayHtml(config);
  const canvas = sketchpadContainer.querySelector(
    "#sketchpad-canvas",
  ) as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d") ?? null;
  fillSketchpadBackground(ctx, config);
  drawSketchpadBackgroundImage(ctx, config);

  const snapshots: ImageData[] = [];
  const redoSnapshots: ImageData[] = [];
  let drawing = false;
  let currentColor = String(resolvePreviewParam(config.stroke_color, "#000000"));

  const clearButton = sketchpadContainer.querySelector(
    "#sketchpad-clear",
  ) as HTMLButtonElement | null;
  const undoButton = sketchpadContainer.querySelector(
    "#sketchpad-undo",
  ) as HTMLButtonElement | null;
  const redoButton = sketchpadContainer.querySelector(
    "#sketchpad-redo",
  ) as HTMLButtonElement | null;

  const updateButtons = () => {
    if (clearButton) clearButton.disabled = snapshots.length === 0;
    if (undoButton) undoButton.disabled = snapshots.length === 0;
    if (redoButton) redoButton.disabled = redoSnapshots.length === 0;
  };

  const saveSnapshot = () => {
    /* v8 ignore start -- saveSnapshot is only called after equivalent canvas/context guards. */
    if (!canvas || !ctx) return;
    /* v8 ignore stop */
    snapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoSnapshots.length = 0;
    updateButtons();
  };

  const pointerPosition = (event: PointerEvent) => {
    const rect = canvas!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas!.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas!.height,
    };
  };

  const startDrawing = (event: PointerEvent) => {
    if (!canvas || !ctx) return;
    saveSnapshot();
    drawing = true;
    canvas.setPointerCapture?.(event.pointerId);
    const point = pointerPosition(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.strokeStyle = currentColor;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Number(resolvePreviewParam(config.stroke_width, 2));
  };

  const moveDrawing = (event: PointerEvent) => {
    if (!drawing || !ctx) return;
    const point = pointerPosition(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    drawing = false;
    ctx?.closePath();
    updateButtons();
  };

  canvas?.addEventListener("pointerdown", startDrawing);
  canvas?.addEventListener("pointermove", moveDrawing);
  canvas?.addEventListener("pointerup", stopDrawing);
  canvas?.addEventListener("pointerleave", stopDrawing);
  canvas?.addEventListener("pointercancel", stopDrawing);

  sketchpadContainer
    .querySelectorAll<HTMLButtonElement>(".sketchpad-color-select")
    .forEach((button) => {
      button.addEventListener("click", () => {
        currentColor = button.dataset.color || currentColor;
      });
    });

  clearButton?.addEventListener("click", () => {
    if (!canvas || !ctx) return;
    saveSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillSketchpadBackground(ctx, config);
    updateButtons();
  });

  undoButton?.addEventListener("click", () => {
    if (!canvas || !ctx || snapshots.length === 0) return;
    redoSnapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snapshots.pop()!, 0, 0);
    updateButtons();
  });

  redoButton?.addEventListener("click", () => {
    if (!canvas || !ctx || redoSnapshots.length === 0) return;
    snapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(redoSnapshots.pop()!, 0, 0);
    updateButtons();
  });

  return {
    element: sketchpadContainer,
    canvas,
    ctx,
    destroy() {
      canvas?.removeEventListener("pointerdown", startDrawing);
      canvas?.removeEventListener("pointermove", moveDrawing);
      canvas?.removeEventListener("pointerup", stopDrawing);
      canvas?.removeEventListener("pointerleave", stopDrawing);
      canvas?.removeEventListener("pointercancel", stopDrawing);
      sketchpadContainer.remove();
    },
  };
}

type RuntimeCopy = {
  element: HTMLElement;
  destroy: () => void;
};

type AssetResolver = (value: string) => string;

function resolveComponentConfig(
  component: TrialComponent,
  canvasStyles: CanvasStyles,
  resolveAsset: AssetResolver,
) {
  const config: Record<string, any> = {};

  Object.entries(component.config || {}).forEach(([key, entry]) => {
    if (entry && typeof entry === "object" && entry.source === "none") return;
    config[key] = resolvePreviewParam(entry, undefined);
  });

  config.name = config.name || component.id;
  config.type = component.type;
  config.coordinates = { x: 0, y: 0 };
  config.zIndex = 0;
  config.rotation = 0;
  config.__canvasStyles = canvasStyles;
  config.__canvas_width = canvasStyles.width;

  const exportsBoxSize =
    component.type !== "HtmlComponent" &&
    component.type !== "SurveyComponent" &&
    component.type !== "SketchpadComponent" &&
    component.type !== "FileUploadResponseComponent";

  if (exportsBoxSize && component.width > 0 && config.width == null) {
    config.width = (component.width / canvasStyles.width) * 100;
  }
  if (exportsBoxSize && component.height > 0 && config.height == null) {
    config.height = (component.height / canvasStyles.width) * 100;
  }

  if (component.type === "InputResponseComponent") {
    const fontSize = Number(
      component.inputFontSize ?? config.input_font_size ?? 16,
    );
    const width = component.inputWidth ?? 10 * fontSize * 0.55;
    config.width = (width / canvasStyles.width) * 100;
    config.height = ((fontSize * 1.5) / canvasStyles.width) * 100;
  }

  config.__preview_width =
    config.width != null
      ? (Number(config.width) / 100) * canvasStyles.width
      : undefined;
  config.__preview_height =
    config.height != null
      ? (Number(config.height) / 100) * canvasStyles.width
      : undefined;

  if (component.type === "ImageComponent") {
    config.stimulus = resolveAsset(String(config.stimulus || ""));
  }

  if (component.type === "VideoComponent") {
    const sources = Array.isArray(config.stimulus)
      ? config.stimulus
      : [config.stimulus].filter(Boolean);
    config.stimulus = sources.map((source: unknown) =>
      resolveAsset(String(source)),
    );
  }

  if (component.type === "ButtonResponseComponent") {
    const choices = normalizePreviewChoices(config.choices ?? "Button");
    config.choices = choices.map((choice: unknown) => {
      const value = String(choice);
      return isImageUrl(value) ? resolveAsset(value) : value;
    });
  }

  if (component.type === "SketchpadComponent" && config.background_image) {
    config.background_image = resolveAsset(String(config.background_image));
  }

  return config;
}

function resolveEditorViewportLength(value: any, canvasWidth: number) {
  const raw = String(value || "min(100vw, 800px)");
  return raw.replace(
    /(-?\d+(?:\.\d+)?)vw\b/gi,
    (_match, amount) => `${(Number(amount) / 100) * canvasWidth}px`,
  );
}

function renderPreviewSurveyComponent(
  container: HTMLElement,
  config: any,
  canvasStyles: CanvasStyles,
): RuntimeCopy {
  const surveyJson =
    config.survey_json && typeof config.survey_json === "object"
      ? JSON.parse(JSON.stringify(config.survey_json))
      : {};
  const themeVariables = surveyJson.themeVariables || {};
  const survey = new Model(surveyJson);

  if (typeof config.survey_function === "function") {
    config.survey_function(survey);
  }
  const applyTheme = (survey as unknown as {
    applyTheme?: (theme: {
      cssVariables: Record<string, unknown>;
      themeName: string;
      colorPalette: string;
      isPanelless: boolean;
    }) => void;
  }).applyTheme;
  if (Object.keys(themeVariables).length > 0 && typeof applyTheme === "function") {
    applyTheme.call(survey, {
      cssVariables: themeVariables,
      themeName: "plain",
      colorPalette: "light",
      isPanelless: false,
    });
  }
  const onValidateQuestion = (survey as unknown as {
    onValidateQuestion?: { add?: (handler: unknown) => void };
  }).onValidateQuestion;
  if (
    typeof config.validation_function === "function" &&
    typeof onValidateQuestion?.add === "function"
  ) {
    onValidateQuestion.add(config.validation_function);
  }

  const rendered = renderPreviewSurveyContainer(
    container,
    {
      ...config,
      min_width: resolveEditorViewportLength(
        config.min_width,
        canvasStyles.width,
      ),
    },
    { coordinateMode: "none" },
  );
  const root = createRoot(rendered.surveyHost);
  root.render(React.createElement(Survey, { model: survey }));

  return {
    element: rendered.element,
    destroy() {
      root.unmount();
      rendered.element.remove();
    },
  };
}

/**
 * ponytail: frontend-only visual copy of DynamicPlugin renderers.
 * Keep this switch in sync only when a backend component's visible output changes.
 */
export function renderRuntimeCopy(
  container: HTMLElement,
  component: TrialComponent,
  canvasStyles: CanvasStyles,
  resolveAsset: AssetResolver = (value) => value,
): RuntimeCopy {
  const config = resolveComponentConfig(component, canvasStyles, resolveAsset);
  const context: RenderContext = { coordinateMode: "none", canvasStyles };

  if (component.type === "SurveyComponent") {
    return renderPreviewSurveyComponent(container, config, canvasStyles);
  }

  if (component.type === "SketchpadComponent") {
    const rendered = renderPreviewSketchpadComponent(container, config, context);
    return {
      element: rendered.element,
      destroy: rendered.destroy,
    };
  }

  const element =
    component.type === "ImageComponent"
      ? renderPreviewImageComponent(container, config, context)
      : component.type === "VideoComponent"
        ? renderPreviewVideoComponent(container, config, context)
        : component.type === "HtmlComponent"
          ? renderPreviewHtmlComponent(container, config, context)
          : component.type === "TextComponent"
            ? renderPreviewTextComponent(container, config, context)
            : component.type === "ButtonResponseComponent"
              ? renderPreviewButtonComponent(container, config, context)
              : component.type === "InputResponseComponent"
                ? renderPreviewInputComponent(container, config, context)
                : component.type === "SliderResponseComponent"
                  ? renderPreviewSliderComponent(container, config, context)
                  : component.type === "FileUploadResponseComponent"
                    ? renderPreviewFileUploadComponent(container, config, context)
                    : null;

  if (!element) {
    throw new Error(`No frontend runtime copy for ${component.type}`);
  }

  return {
    element,
    destroy() {
      element.remove();
    },
  };
}
import { makeGrapesHtmlPortable } from "../GrapesEditors/portableHtml";
