import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import TrialDesigner from "../../src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner";
import { image, typed } from "../../runtime-e2e/support/responsiveScene";
import "../../src/index.css";
import "bootstrap/dist/css/bootstrap.min.css";

type Config = Record<string, { source: string; value: unknown }>;
const recorded: { saves: Config[]; autosaves: Config[]; reopen?: () => void } =
  { saves: [], autosaves: [] };
Object.defineProperty(window, "designerRecorded", { value: recorded });
const initial: Config = {
  components: typed([
    {
      type: "TextComponent",
      text: typed("Welcome"),
      coordinates: { x: 0, y: 60 },
      width: 60,
      _font_size_runtime_vw: typed(2.5),
    },
    {
      type: "ImageComponent",
      stimulus: typed(image),
      coordinates: { x: 0, y: 0 },
      width: 20,
      height: 20,
    },
  ]),
  response_components: typed([
    {
      type: "ButtonResponseComponent",
      choices: typed(["Continue"]),
      coordinates: { x: 0, y: -60 },
      width: 20,
      height: 5,
      _button_font_size_runtime_vw: typed(2),
    },
  ]),
};

export default function Harness() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    recorded.reopen = () => setRevision((value) => value + 1);
    return () => {
      delete recorded.reopen;
    };
  }, []);
  return (
    <TrialDesigner
      key={revision}
      isOpen
      onClose={() => {}}
      columnMapping={recorded.saves.at(-1) ?? initial}
      csvColumns={[]}
      uploadedFiles={[]}
      onSave={(config) => recorded.saves.push(config)}
      onAutoSave={(config) => recorded.autosaves.push(config)}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <Harness />
  </MemoryRouter>,
);
