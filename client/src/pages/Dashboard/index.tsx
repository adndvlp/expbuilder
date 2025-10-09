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
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Cargar experimentos al montar
  useEffect(() => {
    fetch("/api/load-experiments")
      .then((res) => res.json())
      .then((data) => setExperiments(data.experiments || []));
  }, []);

  console.log(localStorage.getItem("user"));

  // Crear experimento
  const handleCreate = async () => {
    const name = prompt("Experiment name:");
    if (!name) return;
    setLoading(true);
    // Obtener el uid del usuario autenticado si está disponible
    let uid = null;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.uid) {
          uid = user.uid;
        }
      }
    } catch (e) {
      // Ignorar errores de parseo
    }
    const body = uid ? { name, uid } : { name };
    const res = await fetch("/api/create-experiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) setExperiments((prev) => [...prev, data.experiment]);
    setLoading(false);
  };

  // Eliminar experimento
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this experiment?")) return;
    setLoading(true);

    // Obtener el uid del usuario autenticado si está disponible
    let uid = null;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.uid) {
          uid = user.uid;
        }
      }
    } catch (e) {
      // Ignorar errores de parseo
    }

    const body = uid ? { uid } : {};
    await fetch(`/api/delete-experiment/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
                navigate("/home/settings");
              }}
            >
              Settings
            </div>
            <div
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                // Aquí deberías limpiar el estado de autenticación si existe
                navigate("/auth/login");
              }}
            >
              Logout
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
    </div>
  );
}

export default Dashboard;
