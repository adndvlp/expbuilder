import { makeGrapesHtmlPortable } from "../GrapesEditors/portableHtml";
import {
  applyPreviewPosition,
  resolvePreviewParam,
  type RenderContext,
} from "./runtimePreviewShared";

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

  // Same sizing rules as the runtime component: honor an explicit design box
  // (vw percentages) and otherwise hug the content capped to the canvas, so
  // long unbroken text cannot spill outside it.
  const canvasWidth = Number(context.canvasStyles?.width) || 1024;
  const explicitWidth = Number(resolvePreviewParam(config.width, null));
  const explicitHeight = Number(resolvePreviewParam(config.height, null));
  const hasExplicitWidth = Number.isFinite(explicitWidth) && explicitWidth > 0;
  const hasExplicitHeight =
    Number.isFinite(explicitHeight) && explicitHeight > 0;

  if (hasExplicitWidth) {
    stimulusElement.style.width = `${(explicitWidth / 100) * canvasWidth}px`;
  } else {
    stimulusElement.style.width = "max-content";
    stimulusElement.style.maxWidth = `${canvasWidth}px`;
  }
  if (hasExplicitHeight) {
    stimulusElement.style.minHeight = `${(explicitHeight / 100) * canvasWidth}px`;
  }
  stimulusElement.style.overflowWrap = "break-word";

  applyPreviewPosition(stimulusElement, config, context);
  // Same isolation as the runtime component: the pasted markup lives in a
  // shadow root so its styles cannot leak into the designer page.
  const html = makeGrapesHtmlPortable(resolvePreviewParam(config.stimulus, ""));
  if (typeof stimulusElement.attachShadow === "function") {
    const shadowRoot = stimulusElement.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = html;
  } else {
    stimulusElement.innerHTML = html;
  }
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
    const configuredWidth = Number(
      resolvePreviewParam(config.__preview_width, 0),
    );
    const configuredHeight = Number(
      resolvePreviewParam(config.__preview_height, 0),
    );

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
    const filename = source.includes("?")
      ? source.slice(0, source.indexOf("?"))
      : source;
    const type = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
    const sourceElement = document.createElement("source");
    sourceElement.src = source;
    sourceElement.type = type ? `video/${type}` : "";
    videoElement.appendChild(sourceElement);
  });

  return stimulusWrapper;
}
