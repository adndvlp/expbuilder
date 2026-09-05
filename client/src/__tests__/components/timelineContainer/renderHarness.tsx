import React, { useState } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import UrlContext from "../../../pages/ExperimentBuilder/contexts/UrlContext";
import Timeline from "../../../pages/ExperimentBuilder/components/Timeline";

export function okDoc(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

export function renderTimeline(initialExperimentUrl = "") {
  const uploadedFiles = [
    { name: "asset.png", url: "/uploads/asset.png", type: "image" },
  ];
  const handleFileUpload = vi.fn(async () => undefined);
  const handleDeleteFile = vi.fn(async () => undefined);
  const handleDeleteMultipleFiles = vi.fn(async () => undefined);
  const fileInputRef = React.createRef<HTMLInputElement>();
  const folderInputRef = React.createRef<HTMLInputElement>();

  function Wrapper() {
    const [experimentUrl, setExperimentUrl] = useState(initialExperimentUrl);
    const [trialUrl, setTrialUrl] = useState("");
    return (
      <UrlContext.Provider
        value={{ experimentUrl, setExperimentUrl, trialUrl, setTrialUrl }}
      >
        <Timeline
          uploadedFiles={uploadedFiles}
          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          handleFileUpload={handleFileUpload}
          handleDeleteFile={handleDeleteFile}
          handleDeleteMultipleFiles={handleDeleteMultipleFiles}
        />
      </UrlContext.Provider>
    );
  }

  return {
    ...render(<Wrapper />),
    uploadedFiles,
    handleFileUpload,
    handleDeleteFile,
    handleDeleteMultipleFiles,
    fileInputRef,
    folderInputRef,
  };
}

export function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  });
}

export function installClipboard(writeText = vi.fn(async () => undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}
