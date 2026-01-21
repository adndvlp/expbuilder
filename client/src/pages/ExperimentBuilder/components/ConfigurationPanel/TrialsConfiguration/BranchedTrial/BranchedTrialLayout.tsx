import { Dispatch, SetStateAction, useState } from "react";
import ParamsOverride from "../ParamsOverride";
import BranchConditions from "./BranchConditions";
import { Condition, Parameter } from "./types";
import { DataDefinition } from "../../types";

type Props = {
  data: DataDefinition[];
  conditions: Condition[];
  selectedTrial: any;
  error: string | null;
  loading: boolean;
  targetTrialParameters: Record<string, Parameter[]>;
  targetTrialCsvColumns: Record<string, string[]>;
  onClose: (() => void) | undefined;
  handleSaveConditions: (conditionsToSave?: Condition[] | undefined) => void;
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  findTrialByIdSync: (trialId: string | number) => any;
};

function BranchedTrialLayout({
  data,
  conditions,
  selectedTrial,
  error,
  loading,
  targetTrialParameters,
  targetTrialCsvColumns,
  setConditions,
  onClose,
  handleSaveConditions,
  loadTargetTrialParameters,
  findTrialByIdSync,
}: Props) {
  const [activeTab, setActiveTab] = useState<"branch" | "params">("branch");
  return (
    <>
      {/* Tab Navigation */}
      <div
        style={{
          borderBottom: "2px solid var(--neutral-mid)",
          padding: "16px 24px 8px",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("branch")}
            style={{
              padding: "12px 24px",
              borderRadius: "8px 8px 0 0",
              fontWeight: 600,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              backgroundColor:
                activeTab === "branch"
                  ? "var(--primary-blue)"
                  : "var(--neutral-light)",
              color:
                activeTab === "branch"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "branch" ? "3px solid var(--gold)" : "none",
              opacity: activeTab === "branch" ? 1 : 0.7,
              boxShadow:
                activeTab === "branch"
                  ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                  : "none",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "branch") {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = "var(--neutral-mid)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "branch") {
                e.currentTarget.style.opacity = "0.7";
                e.currentTarget.style.backgroundColor = "var(--neutral-light)";
              }
            }}
          >
            Branch & Jump Conditions
          </button>
          <button
            onClick={() => setActiveTab("params")}
            style={{
              padding: "12px 24px",
              borderRadius: "8px 8px 0 0",
              fontWeight: 600,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              backgroundColor:
                activeTab === "params"
                  ? "var(--primary-blue)"
                  : "var(--neutral-light)",
              color:
                activeTab === "params"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "params" ? "3px solid var(--gold)" : "none",
              opacity: activeTab === "params" ? 1 : 0.7,
              boxShadow:
                activeTab === "params"
                  ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                  : "none",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "params") {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = "var(--neutral-mid)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "params") {
                e.currentTarget.style.opacity = "0.7";
                e.currentTarget.style.backgroundColor = "var(--neutral-light)";
              }
            }}
          >
            Params Override
          </button>
        </div>
      </div>
      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          padding: "24px",
          overflowY: "auto",
          overflowX: "hidden",
          backgroundColor: "var(--background)",
        }}
      >
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "32px",
              borderRadius: "12px",
              border: "1px solid var(--neutral-mid)",
              backgroundColor: "var(--neutral-light)",
            }}
          >
            <div
              style={{
                display: "inline-block",
                width: "32px",
                height: "32px",
                border: "4px solid var(--primary-blue)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
            <p
              style={{
                marginTop: "12px",
                color: "var(--text-dark)",
                fontSize: "14px",
              }}
            >
              Loading data fields...
            </p>
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "2px solid var(--danger)",
              backgroundColor: "rgba(207, 0, 11, 0.05)",
              color: "var(--text-dark)",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && activeTab === "branch" && (
          <BranchConditions
            conditions={conditions}
            setConditions={setConditions}
            loadTargetTrialParameters={loadTargetTrialParameters}
            findTrialById={findTrialByIdSync}
            targetTrialParameters={targetTrialParameters}
            targetTrialCsvColumns={targetTrialCsvColumns}
            selectedTrial={selectedTrial}
            data={data}
            onAutoSave={handleSaveConditions}
          />
        )}

        {/* PARAMS OVERRIDE TAB CONTENT */}
        {activeTab === "params" && (
          <ParamsOverride selectedTrial={selectedTrial} onClose={onClose} />
        )}
      </div>
      {/* Footer con botón de guardar */}
      {activeTab !== "params" && (
        <div
          style={{
            padding: "16px 24px",
            borderTop: "2px solid var(--neutral-mid)",
            backgroundColor: "var(--background)",
          }}
        >
          <button
            onClick={handleSaveConditions}
            style={{
              width: "100%",
              padding: "12px 32px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
              boxShadow: "0 4px 12px rgba(212, 175, 55, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 6px 16px rgba(212, 175, 55, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(212, 175, 55, 0.3)";
            }}
          >
            Save configuration
          </button>
        </div>
      )}
      ;
    </>
  );
}

export default BranchedTrialLayout;
