import {
  applyPreviewPosition,
  resolvePreviewParam,
  type RenderContext,
} from "./runtimePreviewShared";
import {
  isTransparent,
  parsePadding,
  roundedRectPath,
} from "./runtimePreviewTextLayout";

export function isImageUrl(value: string): boolean {
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

export function normalizePreviewChoices(value: unknown) {
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
  const rows = Math.max(
    1,
    Number(resolvePreviewParam(config.grid_rows, 1)) || 1,
  );
  const configuredColumns = Number(resolvePreviewParam(config.grid_columns, 0));
  const columns =
    Number.isFinite(configuredColumns) && configuredColumns > 0
      ? Math.max(1, configuredColumns)
      : Math.max(1, Math.ceil(choices.length / rows));
  const padding = parsePadding(config.button_padding, "6px 14px");
  const fontSize = Number(resolvePreviewParam(config.button_font_size, 14));
  const imageButtonWidth = Number(
    resolvePreviewParam(config.image_button_width, 150),
  );
  const imageButtonHeight = Number(
    resolvePreviewParam(config.image_button_height, 150),
  );
  const imageSources = new Map<string, HTMLImageElement>();
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (measureContext) measureContext.font = `${fontSize}px sans-serif`;
  const naturalButtonWidth = Math.max(
    80,
    ...choices.map((choice) =>
      isImageUrl(choice)
        ? imageButtonWidth + padding.left + padding.right + 10
        : (measureContext?.measureText(choice).width ??
            choice.length * fontSize * 0.55) +
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
      const borderWidth = Number(
        resolvePreviewParam(config.button_border_width, 1),
      );
      const borderColor = resolvePreviewParam(
        config.button_border_color,
        "#999999",
      );

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
          fittedFontSize *= Math.max(
            0.5,
            maxWidth / Math.max(1, measuredWidth),
          );
        }
        ctx.font = `${Math.max(1, fittedFontSize)}px sans-serif`;
        ctx.fillStyle = resolvePreviewParam(
          config.button_text_color,
          "#000000",
        );
        ctx.fillText(choice, x + w / 2, y + h / 2, maxWidth);
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
