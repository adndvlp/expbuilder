const DEFAULT_TEXT_WIDTH = 200;
const MIN_TEXT_HEIGHT = 40;
const DEFAULT_MAX_WIDTH = 900;
const DEFAULT_LINE_HEIGHT = 1.5;
const CHAR_WIDTH_RATIO = 0.55;
const HORIZONTAL_PADDING = 8;
const VERTICAL_PADDING = 8;
const MAX_CANVAS_WIDTH_RATIO = 0.86;

type TextSizeOptions = {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  canvasWidth?: number;
  maxWidth?: number;
};

function getMaxWidth(canvasWidth?: number, maxWidth?: number) {
  if (maxWidth && maxWidth > 0) return maxWidth;
  if (canvasWidth && canvasWidth > 0) {
    return Math.max(DEFAULT_TEXT_WIDTH, canvasWidth * MAX_CANVAS_WIDTH_RATIO);
  }
  return DEFAULT_MAX_WIDTH;
}

function estimateLineWidth(line: string, fontSize: number) {
  return Math.ceil(line.length * fontSize * CHAR_WIDTH_RATIO + HORIZONTAL_PADDING);
}

function estimateLineTextWidth(line: string, fontSize: number) {
  return Math.ceil(line.length * fontSize * CHAR_WIDTH_RATIO);
}

export function getTextNaturalSize({
  text,
  fontSize = 16,
  lineHeight = DEFAULT_LINE_HEIGHT,
  canvasWidth,
  maxWidth,
}: TextSizeOptions) {
  const safeText = text.length > 0 ? text : "Text";
  const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  const safeLineHeight =
    Number.isFinite(lineHeight) && lineHeight > 0
      ? lineHeight
      : DEFAULT_LINE_HEIGHT;
  const targetMaxWidth = getMaxWidth(canvasWidth, maxWidth);
  const lines = safeText.split(/\r?\n/);
  const longestLineWidth = Math.max(
    ...lines.map((line) => estimateLineWidth(line, safeFontSize)),
  );
  const width = Math.max(
    DEFAULT_TEXT_WIDTH,
    Math.min(longestLineWidth, targetMaxWidth),
  );
  const usableWidth = Math.max(1, width - HORIZONTAL_PADDING);

  const visualLineCount = lines.reduce((count, line) => {
    const estimated = estimateLineTextWidth(line, safeFontSize);
    return count + Math.max(1, Math.ceil(estimated / usableWidth));
  }, 0);

  const height = Math.max(
    MIN_TEXT_HEIGHT,
    Math.ceil(visualLineCount * safeFontSize * safeLineHeight + VERTICAL_PADDING),
  );

  return { width, height };
}
