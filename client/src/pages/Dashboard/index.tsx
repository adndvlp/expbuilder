import "./index.css";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { PromptModal } from "./PromptModal";
const VITE_API = import.meta.env.VITE_API_URL;

type Experiment = {
  experimentID: string;
  name: string;
  description?: string;
};

function Dashboard() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const navigate = useNavigate();

  // Load experiments on mount
  useEffect(() => {
    fetch(`${VITE_API}/api/load-experiments`)
      .then((res) => res.json())
      .then((data) => setExperiments(data.experiments || []));
  }, []);

  // Create experiment
  const handleCreate = () => {
    setShowPromptModal(true);
  };

  // Confirm experiment creation with entered name
  const handleConfirmCreate = async (name: string) => {
    setShowPromptModal(false);
    setLoading(true);

    const res = await fetch(`${VITE_API}/api/create-experiment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (data.success) setExperiments((prev) => [...prev, data.experiment]);

    setLoading(false);
  };

  // Delete experiment
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this experiment?")) return;
    setLoading(true);

    // Get the authenticated user's uid if available
    let uid = null;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.uid) {
          uid = user.uid;
        }
      }
    } catch {
      // Ignore parsing errors
    }
    const body = uid ? { uid } : {};
    const res = await fetch(`${VITE_API}/api/delete-experiment/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setExperiments((prev) => prev.filter((exp) => exp.experimentID !== id));
    }

    setLoading(false);
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
      <div className="dashboard-list">
        {experiments.map((exp) => (
          <div
            key={exp.experimentID}
            className="experiment-bar"
            onClick={() => handleSelect(exp.experimentID)}
          >
            {exp.name}
            <button
              className="gradient-btn right"
              style={{ float: "right", marginLeft: 16 }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(exp.experimentID);
              }}
              disabled={loading}
            >
              Delete
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
