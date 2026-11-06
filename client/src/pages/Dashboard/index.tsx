import "./index.css";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { PromptModal } from "./PromptModal";
import { auth, subscribeToAuth } from "../../lib/firebase";
import { experimentAuthoringClient } from "../ExperimentBuilder/modules/experiment-authoring";
import { getApiBaseUrl } from "../../lib/apiBaseUrl";
const VITE_API = getApiBaseUrl();

type Experiment = {
  experimentID: string;
  name: string;
  description?: string;
};

function Dashboard() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(auth?.currentUser));

  const navigate = useNavigate();

  const loadExperiments = () => {
    fetch(`${VITE_API}/api/load-experiments`)
      .then((res) => res.json())
      .then((data) => setExperiments(data.experiments || []));
  };

  // Load experiments on mount.
  useEffect(() => {
    loadExperiments();
    return subscribeToAuth((user) => setSignedIn(Boolean(user)));
  }, []);

  // Create experiment
  const handleCreate = () => {
    setShowPromptModal(true);
  };

  // Confirm experiment creation with entered name
  const handleConfirmCreate = async (name: string) => {
    setShowPromptModal(false);
    setLoading(true);

    try {
      const experiment = await experimentAuthoringClient.createExperiment({
        name,
      });
      setExperiments((prev) => [...prev, experiment]);
    } catch (error) {
      console.error("Error creating experiment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, scope: "local" | "remote") => {
    const user = auth?.currentUser;
    if (scope === "remote" && !user) {
      setDeleteError(
        "Sign in to delete published resources. The local experiment was preserved.",
      );
      return;
    }
    const confirmed = window.confirm(
      scope === "remote"
        ? "Delete this experiment? This will permanently delete the associated GitHub repository and data storage folder if published, as well as the local experiment."
        : "Delete this local experiment? Its published resources will remain available.",
    );
    if (!confirmed) return;
    setLoading(true);
    setDeleteError("");
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (scope === "remote" && user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
        if (auth?.currentUser?.uid !== user.uid)
          throw new Error(
            "Your account changed. Sign in again before deleting published resources.",
          );
      }
      const res = await fetch(`${VITE_API}/api/delete-experiment/${id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          scope,
          ...(scope === "remote" && user ? { uid: user.uid } : {}),
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(
          result.message ||
            result.error ||
            "Could not delete the experiment. Local data was preserved.",
        );
      }
      setExperiments((prev) => prev.filter((exp) => exp.experimentID !== id));
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Could not delete the experiment",
      );
    } finally {
      setLoading(false);
    }
  };

  // Navigate to builder
  const handleSelect = (id: string) => {
    navigate(`/home/experiment/${id}`);
  };

  return (
    <div className="dashboard-bg">
      <div className="dashboard-menu">
        <div
          className="menu-icon"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Open menu"
          tabIndex={0}
          role="button"
        >
          <div />
          <div />
          <div />
        </div>
        {menuOpen && (
          <div className="menu-dropdown">
            <div
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                navigate("/settings");
              }}
            >
              Settings
            </div>
            <div
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                navigate("/docs");
              }}
            >
              Documentation
            </div>
          </div>
        )}
      </div>
      <div className="dashboard-actions">
        <button
          className="gradient-btn"
          onClick={handleCreate}
          disabled={loading}
        >
          + Create experiment
        </button>
      </div>
      {deleteError && <p role="alert">{deleteError}</p>}
      {!signedIn && (
        <p id="remote-delete-sign-in">Sign in to delete published resources.</p>
      )}
      <div className="dashboard-list">
        {experiments.map((exp) => (
          <div
            key={exp.experimentID}
            className="experiment-bar"
            onClick={() => handleSelect(exp.experimentID)}
          >
            {exp.name}
            <button
              type="button"
              className="gradient-btn right"
              style={{
                float: "right",
                marginLeft: 16,
                opacity: loading || !signedIn ? 0.6 : 1,
                cursor: loading || !signedIn ? "not-allowed" : "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(exp.experimentID, "remote");
              }}
              disabled={loading || !signedIn}
              aria-describedby={!signedIn ? "remote-delete-sign-in" : undefined}
            >
              Delete experiment and published resources…
            </button>
            <button
              type="button"
              className="gradient-btn right"
              style={{ float: "right", marginLeft: 16 }}
              disabled={loading}
              onClick={(event) => {
                event.stopPropagation();
                void handleDelete(exp.experimentID, "local");
              }}
            >
              Delete from this device
            </button>
          </div>
        ))}
      </div>
      <Outlet />
      <PromptModal
        isOpen={showPromptModal}
        title="Experiment name:"
        placeholder="Enter experiment name"
        onConfirm={handleConfirmCreate}
        onCancel={() => setShowPromptModal(false)}
      />
    </div>
  );
}

export default Dashboard;
