import "./index.css";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

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

  // Hook para saber si el usuario tiene los tokens requeridos
  async function userHasRequiredTokens(uid: string): Promise<boolean> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;
    const data = docSnap.data();
    // Debe tener (Drive o Dropbox) Y Github
    const hasDriveOrDropbox = !!(data.googleDriveTokens || data.dropboxTokens);
    const hasGithub = !!data.githubTokens;
    return hasDriveOrDropbox && hasGithub;
  }

  // Crear experimento
  const handleCreate = async () => {
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
    // Validar tokens si hay uid ANTES del prompt
    if (uid) {
      const hasRequired = await userHasRequiredTokens(uid);
      if (!hasRequired) {
        alert(
          "You must connect Github and at least one of Google Drive or Dropbox in Settings before creating experiments."
        );
        navigate("/settings");
        return;
      }
    }
    const name = prompt("Experiment name:");
    if (!name) return;
    setLoading(true);
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
          {loading ? "Creating..." : "+ Create experiment"}
          {/* Also apply for deleting */}
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
