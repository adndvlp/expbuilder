import "./index.css";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

type Experiment = {
  experimentID: string;
  name: string;
  description?: string;
};

function Dashboard() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Cargar experimentos al montar
  useEffect(() => {
    fetch("/api/load-experiments")
      .then((res) => res.json())
      .then((data) => setExperiments(data.experiments || []));
  }, []);

  // Crear experimento
  const handleCreate = async () => {
    const name = prompt("Experiment name:");
    if (!name) return;
    setLoading(true);
    const res = await fetch("/api/create-experiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.success) setExperiments((prev) => [...prev, data.experiment]);
    setLoading(false);
  };

  // Eliminar experimento
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this experiment?")) return;
    setLoading(true);
    await fetch(`/api/delete-experiment/${id}`, { method: "DELETE" });
    setExperiments((prev) => prev.filter((exp) => exp.experimentID !== id));
    setLoading(false);
  };

  // Navegar al builder
  const handleSelect = (id: string) => {
    navigate(`/home/experiment/${id}`);
  };

  return (
    <div className="dashboard-bg">
      <div className="dashboard-menu">
        <div className="menu-icon">
          <div />
          <div />
          <div />
        </div>
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
    </div>
  );
}

export default Dashboard;
