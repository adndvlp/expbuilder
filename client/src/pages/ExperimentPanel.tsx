import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ResultsList from "./ExperimentBuilder/components/ResultsList";
import { fetchExperimentNameByID } from "./ExperimentBuilder/hooks/useExperimentID";

function ExperimentPanel() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [experimentName, setExperimentName] = useState<string>("");

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
        onClick={() => navigate(`/home/experiment/${id}/builder`)}
        style={{ marginTop: 24 }}
      >
        Go to Builder
      </button>
      <button
        className="gradient-btn"
        style={{ marginTop: 16, marginLeft: 16 }}
        onClick={() => navigate("/home")}
      >
        Go to Home
      </button>
      <ResultsList />
    </div>
  );
}

export default ExperimentPanel;
