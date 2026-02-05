import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ResultsList from "../ExperimentBuilder/components/ResultsList";
import { fetchExperimentNameByID } from "../ExperimentBuilder/hooks/useExperimentID";
import ExperimentSettings from "./ExperimentSettings";

type TabType = "preview" | "local" | "online" | "settings";

function ExperimentPanel() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [experimentName, setExperimentName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("local");

  useEffect(() => {
    if (id) {
      fetchExperimentNameByID(id).then(setExperimentName);
    }
  }, [id]);

  return (
    <div
      style={{
        padding: 32,
        backgroundColor: "var(--neutral-light)",
        minHeight: "100vh",
        width: "100vw",
      }}
    >
      <h1 style={{ color: "var(--text-dark)" }}>Experiment Panel</h1>
      <p
        style={{
          color: "var(--text-dark)",
          fontWeight: "bold",
          fontSize: 20,
          margin: "4px 0 16px 0",
          letterSpacing: 1,
        }}
      >
        Experiment Name:{" "}
        <span style={{ fontWeight: "normal", fontSize: 18 }}>
          {experimentName}
        </span>
      </p>
      <p
        style={{
          color: "var(--text-dark)",
          fontWeight: "bold",
          fontSize: 20,
          margin: "12px 0 4px 0",
          letterSpacing: 1,
        }}
      >
        Experiment ID:{" "}
        <span style={{ fontWeight: "normal", fontSize: 18 }}>{id}</span>
      </p>
      <button
        className="gradient-btn"
        style={{ marginTop: 24 }}
        onClick={() => navigate("/home")}
      >
        Go to Home
      </button>
      <button
        className="gradient-btn"
        onClick={() => navigate(`/home/experiment/${id}/builder`)}
        style={{ marginTop: 16, marginLeft: 16 }}
      >
        Go to Builder
      </button>

      {/* Tabs */}
      <div
        style={{
          marginTop: 32,
          display: "flex",
          gap: 8,
          borderBottom: "2px solid var(--gold)",
        }}
      >
        <button
          onClick={() => setActiveTab("preview")}
          style={{
            padding: "12px 24px",
            border: "none",
            background:
              activeTab === "preview"
                ? "linear-gradient(135deg, var(--gold), var(--dark-gold))"
                : "var(--neutral-medium)",
            color: activeTab === "preview" ? "white" : "var(--text-dark)",
            fontWeight: activeTab === "preview" ? "bold" : "normal",
            cursor: "pointer",
            borderRadius: "8px 8px 0 0",
            fontSize: 16,
            transition: "all 0.2s",
          }}
        >
          Preview Results
        </button>
        <button
          onClick={() => setActiveTab("local")}
          style={{
            padding: "12px 24px",
            border: "none",
            background:
              activeTab === "local"
                ? "linear-gradient(135deg, var(--gold), var(--dark-gold))"
                : "var(--neutral-medium)",
            color: activeTab === "local" ? "white" : "var(--text-dark)",
            fontWeight: activeTab === "local" ? "bold" : "normal",
            cursor: "pointer",
            borderRadius: "8px 8px 0 0",
            fontSize: 16,
            transition: "all 0.2s",
          }}
        >
          Local Experiments
        </button>
        <button
          onClick={() => setActiveTab("online")}
          style={{
            padding: "12px 24px",
            border: "none",
            background:
              activeTab === "online"
                ? "linear-gradient(135deg, var(--gold), var(--dark-gold))"
                : "var(--neutral-medium)",
            color: activeTab === "online" ? "white" : "var(--text-dark)",
            fontWeight: activeTab === "online" ? "bold" : "normal",
            cursor: "pointer",
            borderRadius: "8px 8px 0 0",
            fontSize: 16,
            transition: "all 0.2s",
          }}
        >
          Online Experiments
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          style={{
            padding: "12px 24px",
            border: "none",
            background:
              activeTab === "settings"
                ? "linear-gradient(135deg, var(--gold), var(--dark-gold))"
                : "var(--neutral-medium)",
            color: activeTab === "settings" ? "white" : "var(--text-dark)",
            fontWeight: activeTab === "settings" ? "bold" : "normal",
            cursor: "pointer",
            borderRadius: "8px 8px 0 0",
            fontSize: 16,
            transition: "all 0.2s",
          }}
        >
          Settings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "settings" ? (
        <ExperimentSettings experimentID={id} />
      ) : (
        <ResultsList activeTab={activeTab} />
      )}
    </div>
  );
}

export default ExperimentPanel;
