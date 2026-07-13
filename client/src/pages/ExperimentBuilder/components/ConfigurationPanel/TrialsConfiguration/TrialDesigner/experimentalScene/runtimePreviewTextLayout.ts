import {
  resolvePreviewParam,
  type Padding,
  type TextLayout,
} from "./runtimePreviewShared";

function parseCssPx(raw: string | number | null | undefined): number {
  /* v8 ignore start -- callers normalize padding values to string parts before parsing. */
  if (raw === null || raw === undefined) return 0;
  /* v8 ignore stop */
  /* v8 ignore start -- retained for defensive direct calls; current callers pass strings. */
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  /* v8 ignore stop */
  const match = String(raw)
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

export function parsePadding(raw: any, fallback: string): Padding {
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

export function isTransparent(color: string | null | undefined): boolean {
  if (!color) return true;
  const normalized = String(color).trim().toLowerCase();
  return (
    normalized === "transparent" ||
    normalized === "none" ||
    normalized === "rgba(0,0,0,0)" ||
    normalized === "rgba(0, 0, 0, 0)"
  );
}

export function roundedRectPath(
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

export function createPreviewTextLayout(
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
  const maxBlockWidth = Math.max(
    1,
    previewWidth || Math.max(200, canvasWidth * 0.86),
  );
  const maxTextWidth = Math.max(
    1,
    maxBlockWidth - padding.left - padding.right,
  );

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

  const blockWidth =
    previewWidth || measuredTextWidth + padding.left + padding.right;
  const blockHeight =
    lines.length * lineHeightPx + padding.top + padding.bottom;

  return {
    width: blockWidth,
    height: blockHeight,
    rotation: Number(resolvePreviewParam(config.rotation, 0)),
    lines,
    font,
    fontColor: resolvePreviewParam(config.font_color, "#000000"),
    textAlign: resolvePreviewParam(
      config.text_align,
      "center",
    ) as CanvasTextAlign,
    lineHeightPx,
    padding,
    backgroundColor: resolvePreviewParam(
      config.background_color,
      "transparent",
    ),
    borderRadius: Number(resolvePreviewParam(config.border_radius, 0)),
    borderColor: resolvePreviewParam(config.border_color, "transparent"),
    borderWidth: Number(resolvePreviewParam(config.border_width, 0)),
  };
}

export function drawPreviewTextLayout(
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
