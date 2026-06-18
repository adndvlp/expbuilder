import { CanvasStyles, ComponentType, TrialComponent } from "../types";

export const EXPERIMENTAL_HTML_SCENE_ENABLED = true;

export const HTML_SCENE_COMPONENT_TYPES = new Set<ComponentType>([
  "ImageComponent",
  "VideoComponent",
  "HtmlComponent",
  "TextComponent",
  "ButtonResponseComponent",
  "InputResponseComponent",
  "SliderResponseComponent",
  "SketchpadComponent",
  "SurveyComponent",
  "FileUploadResponseComponent",
]);

export type HtmlSceneNodeMetric = {
  width: number;
  height: number;
};

export type HtmlSceneMetrics = Record<string, HtmlSceneNodeMetric>;

export type HtmlSceneNode = {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  component: TrialComponent;
  canvasStyles: CanvasStyles;
};

export function isHtmlSceneComponent(type: ComponentType): boolean {
  return EXPERIMENTAL_HTML_SCENE_ENABLED && HTML_SCENE_COMPONENT_TYPES.has(type);
}

export function getConfigValue<T = any>(
  component: TrialComponent,
  key: string,
  fallback: T,
): T {
  const entry = component.config?.[key];
  if (entry === undefined || entry === null) return fallback;
  if (typeof entry === "object" && "source" in entry) {
    if (entry.source === "none") return fallback;
    return entry.value !== undefined && entry.value !== null
      ? (entry.value as T)
      : fallback;
  }
  return entry as T;
}

function configuredPixels(
  component: TrialComponent,
  key: "width" | "height",
  canvasWidth: number,
) {
  const configured = Number(getConfigValue(component, key, NaN));
  if (Number.isFinite(configured) && configured > 0) {
    return (configured / 100) * canvasWidth;
  }

  const direct = Number(component[key]);
  return Number.isFinite(direct) && direct > 0 ? direct : null;
}

function fallbackSize(
  component: TrialComponent,
  canvasStyles: CanvasStyles,
): HtmlSceneNodeMetric {
  const width = configuredPixels(component, "width", canvasStyles.width);
  const height = configuredPixels(component, "height", canvasStyles.width);
  if (width && height) return { width, height };

  if (component.type === "SurveyComponent") {
    return { width: Math.min(canvasStyles.width, 800), height: 240 };
  }

  if (component.type === "SketchpadComponent") {
    const isCircle =
      getConfigValue<string>(component, "canvas_shape", "rectangle") ===
      "circle";
    const canvasWidth = Number(
      getConfigValue(
        component,
        isCircle ? "canvas_diameter" : "canvas_width",
        500,
      ),
    );
    const canvasHeight = Number(
      getConfigValue(
        component,
        isCircle ? "canvas_diameter" : "canvas_height",
        500,
      ),
    );
    return { width: canvasWidth, height: canvasHeight + 40 };
  }

  if (component.type === "SliderResponseComponent") {
    return { width: width || 300, height: height || 120 };
  }

  if (component.type === "InputResponseComponent") {
    const fontSize = Number(
      component.inputFontSize ??
        getConfigValue(component, "input_font_size", 16),
    );
    return {
      width: component.inputWidth || width || 10 * fontSize * 0.55,
      height: height || fontSize * 1.5,
    };
  }

  if (component.type === "ButtonResponseComponent") {
    return { width: width || 80, height: height || 34 };
  }

  if (component.type === "TextComponent") {
    return { width: width || 80, height: height || 32 };
  }

  if (component.type === "ImageComponent" || component.type === "VideoComponent") {
    return { width: width || 1, height: height || 1 };
  }

  if (component.type === "FileUploadResponseComponent") {
    return { width: 120, height: 40 };
  }

  return { width: 120, height: 40 };
}

export function getHtmlSceneNode(
  component: TrialComponent,
  canvasStyles: CanvasStyles = {
    backgroundColor: "#ffffff",
    width: 1024,
    height: 768,
    fullScreen: true,
    progressBar: false,
  },
  metrics?: HtmlSceneMetrics,
): HtmlSceneNode | null {
  if (!isHtmlSceneComponent(component.type)) return null;

  const size = metrics?.[component.id] || fallbackSize(component, canvasStyles);
  return {
    id: component.id,
    type: component.type,
    x: component.x,
    y: component.y,
    left: component.x - size.width / 2,
    top: component.y - size.height / 2,
    width: size.width,
    height: size.height,
    rotation: component.rotation || 0,
    zIndex: component.zIndex ?? 0,
    component,
    canvasStyles,
  };
}

export function getHtmlSceneNodes(
  components: TrialComponent[],
  canvasStyles?: CanvasStyles,
  metrics?: HtmlSceneMetrics,
): HtmlSceneNode[] {
  return components
    .map((component) => getHtmlSceneNode(component, canvasStyles, metrics))
    .filter((node): node is HtmlSceneNode => Boolean(node))
    .sort((a, b) => a.zIndex - b.zIndex);
}
