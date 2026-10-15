import type { TrialComponent } from "../types";
import { resolveMediaPreviewUrl } from "../../../../../utils/resolveMediaPreviewUrl";
import type { UploadedFile } from "../../../../../utils/mapFileToUrl";

export type MediaKind = "image" | "audio" | "video";
export type MediaResource = {
  key: string;
  url: string;
  kind: MediaKind;
  instances: number;
};
export type ResourceInventory = {
  resources: MediaResource[];
  unresolved: string[];
  canvasBytes: number;
  componentCount: number;
};

export function collectTrialResources(
  components: TrialComponent[],
  options: {
    experimentID?: string;
    uploadedFiles?: UploadedFile[];
    apiUrl?: string;
  } = {},
): ResourceInventory {
  const resources = new Map<string, MediaResource>();
  const unresolved = new Set<string>();
  let canvasBytes = 0;
  const add = (source: string, kind: MediaKind) => {
    if (!source.trim() || source.startsWith("#")) return;
    const url = resolveMediaPreviewUrl(source.trim(), options);
    const key = `${kind}:${url}`;
    const found = resources.get(key);
    if (found) found.instances++;
    else resources.set(key, { key, url, kind, instances: 1 });
  };
  const value = (input: unknown, owner: string): unknown => {
    if (typeof input === "function") {
      unresolved.add(`${owner}: dynamic value`);
      return undefined;
    }
    if (input && typeof input === "object" && "source" in input) {
      const mapping = input as { source: string; value?: unknown };
      if (mapping.source === "csv") unresolved.add(`${owner}: CSV value`);
      return mapping.source === "typed"
        ? value(mapping.value, owner)
        : undefined;
    }
    return input;
  };
  const media = (input: unknown, kind: MediaKind, owner: string) => {
    const resolved = value(input, owner);
    if (Array.isArray(resolved)) {
      const alternatives = resolved
        .map((entry) => value(entry, owner))
        .filter(
          (entry): entry is string => typeof entry === "string" && !!entry,
        );
      if (alternatives.length > 1)
        unresolved.add(`${owner}: alternative media sources`);
      if (alternatives[0]) add(alternatives[0], kind);
    } else if (typeof resolved === "string") add(resolved, kind);
  };
  const css = (text: string) => {
    for (const match of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
      if (match[2]) add(match[2], "image");
    }
  };
  const html = (text: string, owner: string) => {
    const template = document.createElement("template");
    template.innerHTML = text;
    for (const element of template.content.querySelectorAll(
      "img,video,audio,input[type=image]",
    )) {
      const kind =
        element.tagName === "VIDEO"
          ? "video"
          : element.tagName === "AUDIO"
            ? "audio"
            : "image";
      const src =
        element.getAttribute("src") ||
        element.querySelector("source[src]")?.getAttribute("src");
      if (src) add(src, kind);
      if (
        element.hasAttribute("srcset") ||
        element.querySelectorAll("source").length > 1
      )
        unresolved.add(`${owner}: responsive or alternative sources`);
      const poster = element.getAttribute("poster");
      if (poster) add(poster, "image");
    }
    for (const canvas of template.content.querySelectorAll("canvas"))
      canvasBytes += canvas.width * canvas.height * 4;
    for (const element of template.content.querySelectorAll("[style],style"))
      css(element.getAttribute("style") || element.textContent || "");
    if (
      template.content.querySelector(
        "script,iframe,object,embed,link[rel=stylesheet],picture,svg image",
      )
    )
      unresolved.add(`${owner}: dynamic or embedded HTML resources`);
  };
  const nested = (input: unknown, owner: string) => {
    const resolved = value(input, owner);
    if (typeof resolved === "string") {
      if (/<[a-z][\s\S]*>/i.test(resolved)) html(resolved, owner);
      else if (/url\(/i.test(resolved)) css(resolved);
    } else if (Array.isArray(resolved))
      resolved.forEach((entry) => nested(entry, owner));
    else if (resolved && typeof resolved === "object") {
      for (const [key, entry] of Object.entries(resolved)) {
        if (/^(imageLink|imageUrl|backgroundImage)$/i.test(key))
          media(entry, "image", owner);
        else if (/^(audioLink|audioUrl)$/i.test(key))
          media(entry, "audio", owner);
        else if (/^(videoLink|videoUrl)$/i.test(key))
          media(entry, "video", owner);
        else nested(entry, owner);
      }
    }
  };
  for (const component of components) {
    const kind = (
      {
        ImageComponent: "image",
        VideoComponent: "video",
        AudioComponent: "audio",
      } as const
    )[component.type as "ImageComponent" | "VideoComponent" | "AudioComponent"];
    if (kind) media(component.config.stimulus, kind, component.id);
    for (const [key, entry] of Object.entries(component.config)) {
      if (!(kind && key === "stimulus")) nested(entry, component.id);
    }
    if (component.type === "AudioResponseComponent")
      unresolved.add(`${component.id}: recording grows during the trial`);
    if (component.type === "SketchpadComponent")
      unresolved.add(`${component.id}: drawing buffers and stroke history`);
  }
  return {
    resources: [...resources.values()],
    unresolved: [...unresolved],
    canvasBytes,
    componentCount: components.length,
  };
}
