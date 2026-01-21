import { Dispatch, SetStateAction, useMemo, useState } from "react";
import TrialDesigner from "./TrialDesigner";
import { MdEdit } from "react-icons/md";
import ParameterMapper from "./ParameterMapper";
import { ColumnMapping, FieldDefinition } from "../types";
import { UploadedFile } from "../../Timeline/useFileUpload";

type Props = {
  pluginName: string;
  parameters: FieldDefinition[];
  columnMapping: ColumnMapping;
  csvColumns: string[];
  uploadedFiles: UploadedFile[];
  saveIndicator: boolean;
  savingField: string | null;
  saveColumnMapping: (key: string, value: any) => Promise<void>;
  setColumnMapping: Dispatch<SetStateAction<ColumnMapping>>;
  saveField: (fieldName: string, value: any) => Promise<void>;
};

function TavNavigation({
  pluginName,
  parameters,
  columnMapping,
  csvColumns,
  uploadedFiles,
  saveIndicator,
  savingField,
  saveColumnMapping,
  setColumnMapping,
  saveField,
}: Props) {
  const [showKonvaDesigner, setShowKonvaDesigner] = useState(false);
  const [dynamicPluginTab, setDynamicPluginTab] = useState<
    "components" | "general"
  >("components");
  // Memoize filtered parameters to avoid infinite re-renders
  const filteredDynamicPluginParameters = useMemo(
    () =>
      parameters.filter(
        (p) => !["components", "response_components"].includes(p.key),
      ),
    [parameters],
  );

  return (
    <>
      {" "}
      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "20px",
          padding: "4px",
          backgroundColor: "var(--neutral-light)",
          borderRadius: "12px",
          border: "1px solid var(--neutral-mid)",
        }}
      >
        <button
          type="button"
          onClick={() => setDynamicPluginTab("components")}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.3s ease",
            background:
              dynamicPluginTab === "components"
                ? "linear-gradient(135deg, var(--primary-blue), #2c7a96)"
                : "transparent",
            color:
              dynamicPluginTab === "components" ? "white" : "var(--text-dark)",
            boxShadow:
              dynamicPluginTab === "components"
                ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                : "none",
            transform:
              dynamicPluginTab === "components" ? "scale(1.02)" : "none",
          }}
          onMouseOver={(e) => {
            if (dynamicPluginTab !== "components") {
              e.currentTarget.style.backgroundColor = "rgba(61, 146, 180, 0.1)";
            }
          }}
          onMouseOut={(e) => {
            if (dynamicPluginTab !== "components") {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          Components
        </button>
        <button
          type="button"
          onClick={() => setDynamicPluginTab("general")}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.3s ease",
            background:
              dynamicPluginTab === "general"
                ? "linear-gradient(135deg, var(--primary-blue), #2c7a96)"
                : "transparent",
            color:
              dynamicPluginTab === "general" ? "white" : "var(--text-dark)",
            boxShadow:
              dynamicPluginTab === "general"
                ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                : "none",
            transform: dynamicPluginTab === "general" ? "scale(1.02)" : "none",
          }}
          onMouseOver={(e) => {
            if (dynamicPluginTab !== "general") {
              e.currentTarget.style.backgroundColor = "rgba(61, 146, 180, 0.1)";
            }
          }}
          onMouseOut={(e) => {
            if (dynamicPluginTab !== "general") {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          General Settings
        </button>
      </div>
      {/* Tab Content */}
      {dynamicPluginTab === "components" ? (
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            margin: "24px 0",
          }}
        >
          <button
            type="button"
            onClick={() => setShowKonvaDesigner(true)}
            style={{
              padding: "12px 24px",
              border: "none",
              borderRadius: "10px",
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.3s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(212, 175, 55, 0.3)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 6px 16px rgba(212, 175, 55, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(212, 175, 55, 0.3)";
            }}
          >
            <MdEdit style={{ fontSize: "18px" }} />
            Open Visual Designer
          </button>

          <TrialDesigner
            isOpen={showKonvaDesigner}
            onClose={() => setShowKonvaDesigner(false)}
            onSave={(config) => {
              // Replace columnMapping with the complete config from Konva designer
              // This includes both components and General Settings parameters
              setColumnMapping(config);
              // Also trigger backend save when manually saving/closing
              saveField("columnMapping", config);
              setShowKonvaDesigner(false);
            }}
            onAutoSave={(config) => {
              // Autosave logic: update state and backend without closing
              setColumnMapping(config);
              saveField("columnMapping", config);
            }}
            isAutoSaving={saveIndicator && savingField === "columnMapping"}
            parameters={parameters}
            columnMapping={columnMapping}
            csvColumns={csvColumns}
            pluginName={pluginName}
          />
        </div>
      ) : (
        <ParameterMapper
          pluginName={pluginName}
          parameters={filteredDynamicPluginParameters}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          csvColumns={csvColumns}
          uploadedFiles={uploadedFiles}
          onSave={saveColumnMapping}
        />
      )}
    </>
  );
}

export default TavNavigation;
