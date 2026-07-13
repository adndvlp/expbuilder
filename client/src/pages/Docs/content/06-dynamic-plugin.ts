import type { DocSection } from "./types";
import { DynamicPluginAudioResponseExampleContent } from "./dynamic-plugin/audio-response-data-example";
import { DynamicPluginResponseAndRuntimeContent } from "./dynamic-plugin/response-components-and-runtime-data";
import { DynamicPluginTimingAndStimulusContent } from "./dynamic-plugin/timing-and-stimulus-components";

export const DynamicPluginSection: DocSection = {
  id: "dynamic-plugin",
  title: "Dynamic Plugin",
  content:
    DynamicPluginTimingAndStimulusContent +
    DynamicPluginResponseAndRuntimeContent +
    DynamicPluginAudioResponseExampleContent,
};
