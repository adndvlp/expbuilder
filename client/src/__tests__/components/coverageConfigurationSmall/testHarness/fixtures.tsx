import "./mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CsvUploader from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/CsvUploader";
import ExtensionsConfig from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Extensions";
import OrdersAndCategories from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/OrdersAndCategories";
import { ParameterInput } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput";
import InstructionsArrays from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/InstructionsArrays";
import InstructionsConfig from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/Instructions";
import TrialCodeInjection from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCodeInjection";
import TabContent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TabContent";
import TrialActions from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialActions";
import ExperimentPanel from "../../../../pages/ExperimentPanel";
import { asyncMocks } from "./state";

function InstructionsHarness({
  onSave,
  initialMapping = {
    message: { source: "typed", value: "hello" },
    timeout: { source: "typed", value: 5 },
    enabled: { source: "typed", value: "false" },
  },
  instructionsFields = [
    { label: "Message", key: "message", type: "string" },
    { label: "Timeout", key: "timeout", type: "number" },
    { label: "Enabled", key: "enabled", type: "boolean" },
  ],
  csvColumns = ["csv_message", "csv_timeout"],
}: {
  onSave?: any;
  initialMapping?: Record<string, any>;
  instructionsFields?: Array<{ label: string; key: string; type: string }>;
  csvColumns?: string[];
}) {
  const [includeInstructions, setIncludeInstructions] = useState(true);
  const [columnMapping, setColumnMapping] =
    useState<Record<string, any>>(initialMapping);

  return (
    <InstructionsConfig
      includeInstructions={includeInstructions}
      setIncludeInstructions={setIncludeInstructions}
      instructionsFields={instructionsFields}
      columnMapping={columnMapping}
      setColumnMapping={setColumnMapping}
      csvColumns={csvColumns}
      onSave={onSave}
    />
  );
}

function ExtensionsHarness({ onSave }: { onSave: any }) {
  const [includesExtensions, setIncludeExtensions] = useState(false);
  const [extensionType, setExtensionType] = useState("");

  return (
    <ExtensionsConfig
      includesExtensions={includesExtensions}
      setIncludeExtensions={setIncludeExtensions}
      extensionType={extensionType}
      setExtensionType={setExtensionType}
      parameters={[{ key: "stimulus" }]}
      onSave={onSave}
    />
  );
}

export {
  CsvUploader,
  ExperimentPanel,
  ExtensionsConfig,
  ExtensionsHarness,
  InstructionsArrays,
  InstructionsConfig,
  InstructionsHarness,
  OrdersAndCategories,
  ParameterInput,
  React,
  TabContent,
  TrialActions,
  TrialCodeInjection,
  afterEach,
  asyncMocks,
  beforeEach,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  useNavigate,
  useParams,
  useState,
  vi,
  waitFor,
};
