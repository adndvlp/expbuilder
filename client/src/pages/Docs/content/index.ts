import type { DocSection } from "./types";
import { AnatomySection } from "./01-anatomy";
import { SessionLocalSection } from "./02-session-local";
import { SessionPublicSection } from "./03-session-public";
import { OverlaysSection } from "./04-overlays";
import { TimelineSection } from "./05-timeline";
import { DynamicPluginSection } from "./06-dynamic-plugin";
import { SurveyComponentSection } from "./07-survey-component";
import { BranchingSection } from "./08-branching";
import { ResumeSection } from "./09-resume";
import { ConditionalLoopsSection } from "./10-conditional-loops";
import { NestedLoopsSection } from "./11-nested-loops";
import { InitJspsychSection } from "./12-init-jspsych";
import { CustomCodeSection } from "./13-custom-code";
import { ExtensionsSection } from "./14-extensions";
import { WebgazerSection } from "./15-webgazer";
import { CsvSection } from "./16-csv";
import { CounterbalancingSection } from "./17-counterbalancing";
import { PluginsSection } from "./18-plugins";
import { PublishSection } from "./19-publish";
import { DataFormatSection } from "./20-data-format";
import { ApiReferenceSection } from "./21-api-reference";
import { TroubleshootingSection } from "./22-troubleshooting";

export const DOC_SECTIONS: DocSection[] = [
  AnatomySection,
  SessionLocalSection,
  SessionPublicSection,
  OverlaysSection,
  TimelineSection,
  DynamicPluginSection,
  SurveyComponentSection,
  BranchingSection,
  ResumeSection,
  ConditionalLoopsSection,
  NestedLoopsSection,
  InitJspsychSection,
  CustomCodeSection,
  ExtensionsSection,
  WebgazerSection,
  CsvSection,
  CounterbalancingSection,
  PluginsSection,
  PublishSection,
  DataFormatSection,
  ApiReferenceSection,
  TroubleshootingSection,
];

export type { DocSection } from "./types";
