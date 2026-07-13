import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  mapperProps: undefined as any,
  extensionsProps: undefined as any,
  tabContentProps: undefined as any,
  pluginParameters: [
    { key: "stimulus", label: "Stimulus", type: "html_string", default: "" },
    { key: "choices", label: "Choices", type: "string_array", default: [] },
  ],
  pluginData: [{ key: "response", label: "Response", type: "string" }],
  uploadedFiles: [
    { name: "image.png", url: "https://cdn/image.png", type: "image" },
  ],
}));

export { mocks };
