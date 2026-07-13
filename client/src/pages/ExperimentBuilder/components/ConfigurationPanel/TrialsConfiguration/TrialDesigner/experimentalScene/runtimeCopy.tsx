import React from "react";
import { createRoot } from "react-dom/client";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import type { CanvasStyles, TrialComponent } from "../types";
import {
  isImageUrl,
  normalizePreviewChoices,
  renderPreviewButtonComponent,
} from "./runtimePreviewButtons";
import {
  renderPreviewFileUploadComponent,
  renderPreviewInputComponent,
  renderPreviewSliderComponent,
  renderPreviewSurveyContainer,
} from "./runtimePreviewForm";
import {
  renderPreviewHtmlComponent,
  renderPreviewImageComponent,
  renderPreviewVideoComponent,
} from "./runtimePreviewMedia";
import { renderPreviewSketchpadComponent } from "./runtimePreviewSketchpad";
import {
  resolvePreviewParam,
  type RenderContext,
} from "./runtimePreviewShared";
import { renderPreviewTextComponent } from "./runtimePreviewText";

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
  const applyTheme = (
    survey as unknown as {
      applyTheme?: (theme: {
        cssVariables: Record<string, unknown>;
        themeName: string;
        colorPalette: string;
        isPanelless: boolean;
      }) => void;
    }
  ).applyTheme;
  if (
    Object.keys(themeVariables).length > 0 &&
    typeof applyTheme === "function"
  ) {
    applyTheme.call(survey, {
      cssVariables: themeVariables,
      themeName: "plain",
      colorPalette: "light",
      isPanelless: false,
    });
  }
  const onValidateQuestion = (
    survey as unknown as {
      onValidateQuestion?: { add?: (handler: unknown) => void };
    }
  ).onValidateQuestion;
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
    const rendered = renderPreviewSketchpadComponent(
      container,
      config,
      context,
    );
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
                    ? renderPreviewFileUploadComponent(
                        container,
                        config,
                        context,
                      )
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
