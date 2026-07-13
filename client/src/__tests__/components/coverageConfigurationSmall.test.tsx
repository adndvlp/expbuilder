import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CsvUploader from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/CsvUploader";
import ExtensionsConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Extensions";
import OrdersAndCategories from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/OrdersAndCategories";
import { ParameterInput } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput";
import InstructionsArrays from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/InstructionsArrays";
import InstructionsConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/Instructions";
import TrialCodeInjection from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCodeInjection";
import TabContent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TabContent";
import TrialActions from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialActions";
import ExperimentPanel from "../../pages/ExperimentPanel";

const asyncMocks = vi.hoisted(() => ({
  fetchExperimentNameByID: vi.fn(async () => "Loaded Experiment"),
}));

vi.mock("react-switch", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: ({ checked, onChange, id }: any) =>
      React.createElement(
        "button",
        {
          type: "button",
          id,
          role: "switch",
          "aria-checked": checked,
          onClick: () => onChange(!checked),
        },
        checked ? "on" : "off",
      ),
  };
});

vi.mock("../../pages/ExperimentBuilder/components/CodeEditorModal", () => ({
  default: ({ isOpen, title, tabs, onClose }: any) =>
    isOpen ? (
      <section role="dialog" aria-label={title}>
        {tabs.map((tab: any) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => tab.onChange(`${tab.value} updated`)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" onClick={onClose}>
          Close modal
        </button>
      </section>
    ) : null,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner",
  () => ({
    default: ({ isOpen, onSave, onAutoSave, onClose }: any) =>
      isOpen ? (
        <div data-testid="trial-designer">
          <button type="button" onClick={() => onAutoSave({ components: [] })}>
            Auto save designer
          </button>
          <button type="button" onClick={() => onSave({ saved: true })}>
            Save designer
          </button>
          <button type="button" onClick={onClose}>
            Close designer
          </button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: ({ parameters, onSave }: any) => (
      <div data-testid="parameter-mapper">
        <span>{parameters.map((p: any) => p.key).join(",")}</span>
        <button type="button" onClick={() => onSave("difficulty", "hard")}>
          Save mapper
        </button>
      </div>
    ),
  }),
);

vi.mock("../../pages/ExperimentBuilder/components/ResultsList", () => ({
  default: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="results-list">{activeTab}</div>
  ),
}));

vi.mock("../../pages/ExperimentPanel/ExperimentSettings", () => ({
  default: ({ experimentID }: { experimentID?: string }) => (
    <div data-testid="experiment-settings">{experimentID}</div>
  ),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  fetchExperimentNameByID: asyncMocks.fetchExperimentNameByID,
}));

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

describe("coverage configuration: webgazer and configuration primitives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the default webgazer instruction field groups", () => {
    const groups = InstructionsArrays();

    expect(groups.initCameraInstructions[0].key).toBe(
      "plugin_webgazer_init_camera_instructions",
    );
    expect(groups.calibrateInstructions[1].default).toEqual(["Got it"]);
    expect(groups.validateInstructions[2]).toMatchObject({
      key: "post_trial_gap",
      default: 1000,
    });
    expect(groups.recalibrateInstructions[1].default).toEqual(["OK"]);
  });

  it("edits webgazer instruction mappings and saves deferred updates", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(<InstructionsHarness onSave={onSave} />);

    expect(screen.getByText("Instruction Parameters")).toBeInTheDocument();

    const textInput = screen.getByPlaceholderText(
      "Type a value for message",
    ) as HTMLInputElement;
    fireEvent.change(textInput, {
      target: { value: "updated instructions" },
    });
    expect(textInput).toHaveValue("updated instructions");
    fireEvent.blur(textInput);
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("message", {
      source: "typed",
      value: "updated instructions",
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "csv_message" } });
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("message", {
      source: "csv",
      value: "csv_message",
    });

    fireEvent.change(selects[0], { target: { value: "" } });
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("message", undefined);

    fireEvent.change(selects[1], { target: { value: "type_value" } });
    const numberInput = container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "-3" } });
    fireEvent.blur(numberInput);
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("timeout", {
      source: "typed",
      value: 0,
    });

    fireEvent.click(screen.getAllByRole("switch")[1]);
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("enabled", {
      source: "typed",
      value: "true",
    });

    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(screen.queryByText("Instruction Parameters")).not.toBeInTheDocument();
  });

  it("handles missing mappings, invalid typed values, and absent save callbacks", () => {
    const { container } = render(
      <InstructionsHarness
        initialMapping={{
          csvInvalid: { source: "csv", value: { column: "bad" } },
          csvNumber: { source: "csv", value: 7 },
          textNumber: { source: "typed", value: 42 },
          textObject: { source: "typed", value: { nested: true } },
          numberObject: { source: "typed", value: { nested: true } },
          enabled: { source: "typed", value: "false" },
        }}
        instructionsFields={[
          { label: "Missing", key: "missing", type: "string" },
          { label: "Invalid CSV", key: "csvInvalid", type: "string" },
          { label: "Number CSV", key: "csvNumber", type: "string" },
          { label: "Text Number", key: "textNumber", type: "string" },
          { label: "Text Object", key: "textObject", type: "string" },
          { label: "Number Object", key: "numberObject", type: "number" },
          { label: "Enabled", key: "enabled", type: "boolean" },
        ]}
        csvColumns={["csv_message", "7"]}
      />,
    );

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0]).toHaveValue("");
    expect(selects[1]).toHaveValue("");
    expect(selects[2]).toHaveValue("7");

    fireEvent.change(selects[0], { target: { value: "type_value" } });
    fireEvent.click(screen.getByText("True / False").previousElementSibling!);

    const textNumberInput = screen.getByPlaceholderText(
      "Type a value for text number",
    );
    expect(textNumberInput).toHaveValue("42");

    const textObjectInput = screen.getByPlaceholderText(
      "Type a value for text object",
    );
    expect(textObjectInput).toHaveValue("");
    fireEvent.change(textObjectInput, { target: { value: "manual" } });
    fireEvent.blur(textObjectInput);

    const numberInput = container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement;
    expect(numberInput).toHaveValue(null);
    fireEvent.change(numberInput, { target: { value: "4" } });
    fireEvent.blur(numberInput);
  });

  it("renders CSV previews and delete/upload actions", () => {
    const onCsvUpload = vi.fn();
    const onDeleteCSV = vi.fn();
    const { rerender } = render(
      <CsvUploader
        onCsvUpload={onCsvUpload}
        onDeleteCSV={onDeleteCSV}
        csvJson={[{ stimulus: "cat", order: 2 }]}
      />,
    );

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input);
    expect(onCsvUpload).toHaveBeenCalled();
    expect(screen.getByText("Data Preview:")).toBeInTheDocument();
    expect(screen.getByText("stimulus")).toBeInTheDocument();
    expect(screen.getByText("cat")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete"));
    expect(onDeleteCSV).toHaveBeenCalled();

    rerender(
      <CsvUploader
        onCsvUpload={onCsvUpload}
        onDeleteCSV={onDeleteCSV}
        csvJson={[]}
        disabled
      />,
    );
    expect(document.querySelector("input[type='file']")).toBeDisabled();
    expect(screen.queryByText("Data Preview:")).not.toBeInTheDocument();
  });

  it("toggles extensions and saves selected extension types", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const setIncludeExtensions = vi.fn();
    const setExtensionType = vi.fn();
    render(
      <ExtensionsConfig
        includesExtensions={false}
        setIncludeExtensions={setIncludeExtensions}
        extensionType=""
        setExtensionType={setExtensionType}
        parameters={[{ key: "rt" }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));
    vi.advanceTimersByTime(300);
    expect(setIncludeExtensions).toHaveBeenCalledWith(true);
    expect(onSave).toHaveBeenCalledWith(true, "");

    render(<ExtensionsHarness onSave={onSave} />);
    fireEvent.click(screen.getAllByRole("switch")[1]);
    vi.advanceTimersByTime(300);
    expect(screen.getByRole("option", { name: "WebGazer" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "jsPsychExtensionWebgazer" },
    });
    vi.advanceTimersByTime(300);
    expect(onSave).toHaveBeenCalledWith(true, "jsPsychExtensionWebgazer");
  });

  it("offers WebGazer for dynamic plugins even without stimulus parameters", () => {
    render(
      <ExtensionsConfig
        includesExtensions
        setIncludeExtensions={vi.fn()}
        extensionType=""
        setExtensionType={vi.fn()}
        parameters={[]}
        pluginName="plugin-dynamic"
      />,
    );

    expect(screen.getByRole("option", { name: "WebGazer" })).toBeInTheDocument();
  });

  it("updates extension controls without an autosave callback", () => {
    const setIncludeExtensions = vi.fn();
    const setExtensionType = vi.fn();
    render(
      <ExtensionsConfig
        includesExtensions
        setIncludeExtensions={setIncludeExtensions}
        extensionType=""
        setExtensionType={setExtensionType}
        parameters={[]}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "jsPsychExtensionRecordVideo" },
    });

    expect(setIncludeExtensions).toHaveBeenCalledWith(false);
    expect(setExtensionType).toHaveBeenCalledWith(
      "jsPsychExtensionRecordVideo",
    );
  });

  it("maps order and category columns before saving", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const onSave = vi.fn();
    const setOrderColumns = vi.fn();
    const mapOrdersFromCsv = vi.fn();
    const setCategoryColumn = vi.fn();
    const mapCategoriesFromCsv = vi.fn();
    render(
      <OrdersAndCategories
        orders
        setOrders={vi.fn()}
        columnOptions={["order_a", "category"]}
        orderColumns={[]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={mapOrdersFromCsv}
        csvJson={[
          { order_a: 1, category: "easy" },
          { order_a: 3, category: "hard" },
        ]}
        stimuliOrders={[]}
        categories
        setCategories={vi.fn()}
        categoryColumn=""
        setCategoryColumn={setCategoryColumn}
        categoryData={[]}
        mapCategoriesFromCsv={mapCategoriesFromCsv}
        onSave={onSave}
      />,
    );

    const orderSelect = screen.getByLabelText(
      "Select order columns:",
    ) as HTMLSelectElement;
    orderSelect.options[0].selected = true;
    fireEvent.change(orderSelect);
    vi.advanceTimersByTime(100);
    expect(setOrderColumns).toHaveBeenCalledWith(["order_a"]);
    expect(mapOrdersFromCsv).toHaveBeenCalledWith(
      [
        { order_a: 1, category: "easy" },
        { order_a: 3, category: "hard" },
      ],
      ["order_a"],
    );
    expect(onSave).toHaveBeenCalledWith(
      true,
      ["order_a"],
      [[0, 2]],
      true,
      "",
      [],
    );

    fireEvent.change(screen.getByLabelText("Select category column:"), {
      target: { value: "category" },
    });
    vi.advanceTimersByTime(100);
    expect(setCategoryColumn).toHaveBeenCalledWith("category");
    expect(mapCategoriesFromCsv).toHaveBeenCalledWith(
      [
        { order_a: 1, category: "easy" },
        { order_a: 3, category: "hard" },
      ],
      "category",
    );
    expect(onSave).toHaveBeenCalledWith(
      true,
      [],
      [],
      true,
      "category",
      ["easy", "hard"],
    );
  });

  it("clears order and category mappings when their switches are disabled", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const setOrders = vi.fn();
    const setOrderColumns = vi.fn();
    const mapOrdersFromCsv = vi.fn();
    const setCategories = vi.fn();
    const setCategoryColumn = vi.fn();
    const mapCategoriesFromCsv = vi.fn();
    render(
      <OrdersAndCategories
        orders
        setOrders={setOrders}
        columnOptions={[]}
        orderColumns={["order_a"]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={mapOrdersFromCsv}
        csvJson={[{ order_a: 1, category: "easy" }]}
        stimuliOrders={[[0]]}
        categories
        setCategories={setCategories}
        categoryColumn="category"
        setCategoryColumn={setCategoryColumn}
        categoryData={["easy"]}
        mapCategoriesFromCsv={mapCategoriesFromCsv}
        onSave={onSave}
      />,
    );

    expect(screen.getAllByText("No columns available")).toHaveLength(2);

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    vi.advanceTimersByTime(300);
    expect(setOrders).toHaveBeenCalledWith(false);
    expect(setOrderColumns).toHaveBeenCalledWith([]);
    expect(mapOrdersFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      [],
    );
    expect(onSave).toHaveBeenCalledWith(
      false,
      [],
      [],
      true,
      "category",
      ["easy"],
    );

    fireEvent.click(switches[1]);
    vi.advanceTimersByTime(300);
    expect(setCategories).toHaveBeenCalledWith(false);
    expect(setCategoryColumn).toHaveBeenCalledWith("");
    expect(mapCategoriesFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      "",
    );
    expect(onSave).toHaveBeenCalledWith(
      true,
      ["order_a"],
      [[0]],
      false,
      "",
      [],
    );
  });

  it("updates mappings without scheduling saves when onSave is absent", () => {
    const setOrders = vi.fn();
    const setOrderColumns = vi.fn();
    const mapOrdersFromCsv = vi.fn();
    const setCategories = vi.fn();
    const setCategoryColumn = vi.fn();
    const mapCategoriesFromCsv = vi.fn();
    render(
      <OrdersAndCategories
        orders
        setOrders={setOrders}
        columnOptions={["order_a", "category"]}
        orderColumns={["order_a"]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={mapOrdersFromCsv}
        csvJson={[{ order_a: 1, category: "easy" }]}
        stimuliOrders={[[0]]}
        categories
        setCategories={setCategories}
        categoryColumn="category"
        setCategoryColumn={setCategoryColumn}
        categoryData={["easy"]}
        mapCategoriesFromCsv={mapCategoriesFromCsv}
      />,
    );

    const orderSelect = screen.getByLabelText(
      "Select order columns:",
    ) as HTMLSelectElement;
    orderSelect.options[0].selected = false;
    fireEvent.change(orderSelect);
    fireEvent.change(screen.getByLabelText("Select category column:"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getAllByRole("switch")[1]);

    expect(setOrderColumns).toHaveBeenCalledWith([]);
    expect(mapOrdersFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      [],
    );
    expect(setCategoryColumn).toHaveBeenCalledWith("");
    expect(mapCategoriesFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      "",
    );
  });

  it("preserves configured mappings when switches are enabled", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const setOrderColumns = vi.fn();
    const setCategoryColumn = vi.fn();
    render(
      <OrdersAndCategories
        orders={false}
        setOrders={vi.fn()}
        columnOptions={["order_a", "category"]}
        orderColumns={["order_a"]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={vi.fn()}
        csvJson={[{ order_a: 1, category: "easy" }]}
        stimuliOrders={[[0]]}
        categories={false}
        setCategories={vi.fn()}
        categoryColumn="category"
        setCategoryColumn={setCategoryColumn}
        categoryData={["easy"]}
        mapCategoriesFromCsv={vi.fn()}
        onSave={onSave}
      />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    vi.advanceTimersByTime(300);

    expect(setOrderColumns).not.toHaveBeenCalled();
    expect(setCategoryColumn).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(
      true,
      ["order_a"],
      [[0]],
      false,
      "category",
      ["easy"],
    );
    expect(onSave).toHaveBeenCalledWith(
      false,
      ["order_a"],
      [[0]],
      true,
      "category",
      ["easy"],
    );
  });
});

describe("coverage configuration: parameter inputs", () => {
  it("covers direct parameter input branches", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="flag"
        paramLabel="Flag"
        paramType="boolean"
        value={false}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);

    const onOpenHtmlModal = vi.fn();
    rerender(
      <ParameterInput
        paramKey="stimulus"
        paramLabel="Stimulus"
        paramType="html_string"
        value="<p>Hello</p>"
        onChange={onChange}
        onOpenHtmlModal={onOpenHtmlModal}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onOpenHtmlModal).toHaveBeenCalled();

    rerender(
      <ParameterInput
        paramKey="pages"
        paramLabel="Pages"
        paramType="html_string_array"
        value={["<p>Long html content that should be truncated after fifty characters</p>"]}
        onChange={onChange}
        onOpenHtmlModal={onOpenHtmlModal}
      />,
    );
    fireEvent.click(screen.getByText("Edit HTML Array"));
    expect(onOpenHtmlModal).toHaveBeenCalledTimes(2);

    const onOpenSurveyModal = vi.fn();
    rerender(
      <ParameterInput
        paramKey="survey_json"
        paramLabel="Survey"
        paramType="object"
        value={{ title: "T", pages: [] }}
        onChange={onChange}
        onOpenSurveyModal={onOpenSurveyModal}
      />,
    );
    fireEvent.click(screen.getByText("Design Survey"));
    expect(onOpenSurveyModal).toHaveBeenCalled();

    rerender(
      <ParameterInput
        paramKey="duration"
        paramLabel="Duration"
        paramType="number"
        value={10}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "12" } });
    expect(onChange).toHaveBeenCalledWith(12);

    rerender(
      <ParameterInput
        paramKey="choices"
        paramLabel="Choices"
        paramType="number_array"
        value={[1, 2]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("1, 2"), {
      target: { value: "1, bad, 3" },
    });
    fireEvent.blur(screen.getByDisplayValue("1, bad, 3"));
    expect(onChange).toHaveBeenCalledWith([1, "bad", 3]);

    rerender(
      <ParameterInput
        paramKey="calibration_points"
        paramLabel="Calibration Points"
        paramType="number_array"
        value={[
          [0.2, 0.3],
          [0.8, 0.7],
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("[[0.2,0.3], [0.8,0.7]]"), {
      target: { value: "[[0.1, 0.2]]" },
    });
    fireEvent.blur(screen.getByDisplayValue("[[0.1, 0.2]]"));
    expect(onChange).toHaveBeenCalledWith([[0.1, 0.2]]);

    rerender(
      <ParameterInput
        paramKey="coordinates"
        paramLabel="Coordinates"
        paramType="object"
        value={{ x: 1, y: 2 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("X"), { target: { value: "9" } });
    expect(onChange).toHaveBeenCalledWith({ x: 9, y: 2 });

    rerender(
      <ParameterInput
        paramKey="prompt"
        paramLabel="Prompt"
        paramType="string"
        value="Ready"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Ready"), {
      target: { value: "Go" },
    });
    expect(onChange).toHaveBeenCalledWith("Go");
  });

  it("covers alternate parameter input display branches", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="flag"
        paramLabel="Flag"
        paramType="boolean"
        value
        onChange={onChange}
      />,
    );
    expect(screen.getByText("True")).toBeInTheDocument();

    rerender(
      <ParameterInput
        paramKey="stimulus"
        paramLabel="Stimulus"
        paramType="html_string"
        value={123}
        onChange={onChange}
      />,
    );
    expect(screen.getByPlaceholderText("Click edit to add HTML content")).toHaveValue(
      "",
    );

    rerender(
      <ParameterInput
        paramKey="pages"
        paramLabel="Pages"
        paramType="html_string_array"
        value={["short html"]}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content (array)"),
    ).toHaveValue("short html");

    rerender(
      <ParameterInput
        paramKey="pages"
        paramLabel="Pages"
        paramType="html_string_array"
        value={[]}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content (array)"),
    ).toHaveValue("");

    rerender(
      <ParameterInput
        paramKey="survey_json"
        paramLabel="Survey"
        paramType="object"
        value={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByPlaceholderText("Click edit to design survey")).toHaveValue(
      "Survey: Empty",
    );

    rerender(
      <ParameterInput
        paramKey="survey_json"
        paramLabel="Survey"
        paramType="object"
        value="not-survey"
        onChange={onChange}
      />,
    );
    expect(screen.getByPlaceholderText("Click edit to design survey")).toHaveValue(
      "Click edit to design survey",
    );

    rerender(
      <ParameterInput
        paramKey="duration"
        paramLabel="Duration"
        paramType="number"
        value={{}}
        onChange={onChange}
      />,
    );
    expect(document.querySelector("input[type='number']")).toHaveValue(null);

    rerender(
      <ParameterInput
        paramKey="coordinates"
        paramLabel="Coordinates"
        paramType="object"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Y"), {
      target: { value: "7" },
    });
    expect(onChange).toHaveBeenCalledWith({ x: 0, y: 7 });

    rerender(
      <ParameterInput
        paramKey="prompt"
        paramLabel="Prompt"
        paramType="string"
        value={42}
        onChange={onChange}
      />,
    );
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();

    rerender(
      <ParameterInput
        paramKey="prompt"
        paramLabel="Prompt"
        paramType="string"
        value={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByPlaceholderText("Enter prompt")).toHaveValue("");
  });

  it("casts parameter array inputs across string and boolean variants", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="labels"
        paramLabel="Labels"
        paramType="string_array"
        value="alpha, beta"
        onChange={onChange}
      />,
    );
    fireEvent.blur(screen.getByDisplayValue("alpha, beta"));
    expect(onChange).toHaveBeenCalledWith(["alpha", "beta"]);

    rerender(
      <ParameterInput
        paramKey="labels"
        paramLabel="Labels"
        paramType="string_array"
        value={{}}
        onChange={onChange}
      />,
    );
    const labelsInput = screen.getByPlaceholderText(
      "Comma-separated values for labels",
    );
    fireEvent.change(labelsInput, {
      target: { value: "hello   world, bye" },
    });
    fireEvent.blur(labelsInput);
    expect(onChange).toHaveBeenCalledWith(["hello world", "bye"]);

    rerender(
      <ParameterInput
        paramKey="flags"
        paramLabel="Flags"
        paramType="boolean_array"
        value={[]}
        onChange={onChange}
      />,
    );
    const flagsInput = screen.getByPlaceholderText(
      "Comma-separated values for flags",
    );
    fireEvent.change(flagsInput, {
      target: { value: "true, false, maybe" },
    });
    fireEvent.blur(flagsInput);
    expect(onChange).toHaveBeenCalledWith([true, false, "maybe"]);
  });

  it("handles special webgazer point arrays for empty and invalid JSON", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="validation_points"
        paramLabel="Validation Points"
        paramType="number_array"
        value="not-array"
        onChange={onChange}
      />,
    );

    const emptyInput = screen.getByPlaceholderText("Enter validation points");
    expect(emptyInput).toHaveValue("");
    fireEvent.blur(emptyInput);
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(
      <ParameterInput
        paramKey="validation_points"
        paramLabel="Validation Points"
        paramType="number_array"
        value={[]}
        onChange={onChange}
      />,
    );
    const invalidInput = screen.getByPlaceholderText("Enter validation points");
    fireEvent.change(invalidInput, { target: { value: "not json" } });
    fireEvent.blur(invalidInput);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("coverage configuration: tab and code wrappers", () => {
  it("opens trial code injection modal and forwards tab edits", () => {
    const onSave = vi.fn();
    render(
      <TrialCodeInjection
        tabs={[
          {
            key: "on_start",
            label: "On Start",
            hint: "Runs before the trial",
            fieldKey: "custom_on_start",
            customValue: "return 1;",
            computePreview: (code) => `function(){${code}}`,
            isBuilderManaged: true,
          },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText("Code Component"));
    expect(
      screen.getByRole("dialog", { name: "Trial Code Component" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("On Start"));
    expect(onSave).toHaveBeenCalledWith("custom_on_start", "return 1; updated");
    fireEvent.click(screen.getByText("Close modal"));
    expect(
      screen.queryByRole("dialog", { name: "Trial Code Component" }),
    ).not.toBeInTheDocument();
  });

  it("switches dynamic plugin tabs and forwards designer saves", async () => {
    const saveField = vi.fn(async () => {});
    const saveColumnMapping = vi.fn(async () => {});
    const setColumnMapping = vi.fn();
    render(
      <TabContent
        pluginName="plugin-dynamic"
        parameters={[
          { key: "components", label: "Components", type: "array" },
          { key: "difficulty", label: "Difficulty", type: "string" },
        ] as any}
        columnMapping={{}}
        csvColumns={["condition"]}
        uploadedFiles={[]}
        saveIndicator
        savingField="columnMapping"
        saveColumnMapping={saveColumnMapping}
        setColumnMapping={setColumnMapping}
        saveField={saveField}
      />,
    );

    fireEvent.click(screen.getByText("Open Visual Designer"));
    fireEvent.click(screen.getByText("Auto save designer"));
    expect(setColumnMapping).toHaveBeenCalledWith({ components: [] });
    expect(saveField).toHaveBeenCalledWith("columnMapping", { components: [] });

    fireEvent.click(screen.getByText("Save designer"));
    expect(setColumnMapping).toHaveBeenCalledWith({ saved: true });
    expect(saveField).toHaveBeenCalledWith("columnMapping", { saved: true });

    fireEvent.click(screen.getByText("General Settings"));
    expect(screen.getByTestId("parameter-mapper")).toHaveTextContent("difficulty");
    fireEvent.click(screen.getByText("Save mapper"));
    await waitFor(() =>
      expect(saveColumnMapping).toHaveBeenCalledWith("difficulty", "hard"),
    );
  });
});

describe("coverage configuration: experiment panel", () => {
  it("does not load an experiment name when the route has no id", () => {
    vi.mocked(useParams).mockReturnValueOnce({});

    render(<ExperimentPanel />);

    expect(asyncMocks.fetchExperimentNameByID).not.toHaveBeenCalled();
  });

  it("loads experiment name and switches result/settings tabs", async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);

    render(<ExperimentPanel />);

    expect(screen.getByText("Experiment Panel")).toBeInTheDocument();
    await screen.findByText("Loaded Experiment");
    expect(screen.getByTestId("results-list")).toHaveTextContent("local");

    fireEvent.click(screen.getByText("Go to Home"));
    expect(navigate).toHaveBeenCalledWith("/home");

    fireEvent.click(screen.getByText("Go to Builder"));
    expect(navigate).toHaveBeenCalledWith(
      "/home/experiment/test-exp-123/builder",
    );

    fireEvent.click(screen.getByText("Preview Results"));
    expect(screen.getByTestId("results-list")).toHaveTextContent("preview");

    fireEvent.click(screen.getByText("Local Experiments"));
    expect(screen.getByTestId("results-list")).toHaveTextContent("local");

    fireEvent.click(screen.getByText("Online Experiments"));
    expect(screen.getByTestId("results-list")).toHaveTextContent("online");

    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByTestId("experiment-settings")).toHaveTextContent(
      "test-exp-123",
    );
  });
});

describe("coverage configuration: trial actions", () => {
  it("renders trial and loop save states and delegates actions", () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <TrialActions
        onSave={onSave}
        canSave={false}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByRole("button", { name: "Save trial" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    rerender(
      <TrialActions
        onSave={onSave}
        canSave
        onDelete={onDelete}
        isLoop
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Loop" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
