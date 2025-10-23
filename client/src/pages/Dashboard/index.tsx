import "./index.css";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
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
  const [availableStorages, setAvailableStorages] = useState<string[]>([]);
  // Eliminado el provider/context de storage
  const navigate = useNavigate();

  // Cargar experimentos al montar
  useEffect(() => {
    fetch(`${VITE_API}/api/load-experiments`)
      .then((res) => res.json())
      .then((data) => setExperiments(data.experiments || []));
  }, []);

  // console.log(localStorage.getItem("user"));

  // Hook para saber qué tokens tiene el usuario
  async function getUserTokens(
    uid: string
  ): Promise<{ drive: boolean; dropbox: boolean; github: boolean }> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists())
      return { drive: false, dropbox: false, github: false };
    const data = docSnap.data();
    return {
      drive: !!data.googleDriveTokens,
      dropbox: !!data.dropboxTokens,
      github: !!data.githubTokens,
    };
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
      const tokens = await getUserTokens(uid);
      if (!tokens.github || (!tokens.drive && !tokens.dropbox)) {
        alert(
          "You must connect Github and at least one of Google Drive or Dropbox in Settings before creating experiments."
        );
        navigate("/settings");
        return;
      }
      // Determinar opciones disponibles para el modal
      const storages: string[] = [];
      if (tokens.drive) storages.push("drive");
      if (tokens.dropbox) storages.push("dropbox");
      setAvailableStorages(storages);
    } else {
      // Si no hay uid, permite ambos por defecto
      setAvailableStorages(["drive", "dropbox"]);
    }
    setShowPromptModal(true);
  };

  // Confirmar creación del experimento con el nombre ingresado
  const handleConfirmCreate = async (name: string, selectedStorage: string) => {
    setShowPromptModal(false);
    setLoading(true);

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

    // Enviar storage solo al crear experimento
    const body = uid
      ? { name, uid, storage: selectedStorage }
      : { name, storage: selectedStorage };
    const res = await fetch(`${VITE_API}/api/create-experiment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (
      !data.success &&
      data.message?.includes("GitHub token not found or invalid")
    ) {
      alert(
        "Warning: GitHub repository creation failed. Please reconnect your GitHub account in Settings."
      );
      setLoading(false);
      navigate("/settings");
      return;
    }
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

    // Ya no se envía storage, solo uid si está presente
    const body = uid ? { uid } : {};
    const res = await fetch(`${VITE_API}/api/delete-experiment/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (
      !data.success &&
      data.message?.includes("GitHub token not found or invalid")
    ) {
      alert(
        "Warning: GitHub repository deletion failed. Please reconnect your GitHub account in Settings."
      );
      setLoading(false);
      navigate("/settings");
      return;
    }
    setExperiments((prev) => prev.filter((exp) => exp.experimentID !== id));
    // Eliminar storage local asociado al experimento
    try {
      localStorage.removeItem(`experiment_storage_${id}`);
    } catch (e) {}
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
      <PromptModal
        isOpen={showPromptModal}
        title="Experiment name:"
        placeholder="Enter experiment name"
        onConfirm={handleConfirmCreate}
        onCancel={() => setShowPromptModal(false)}
        availableStorages={availableStorages}
      />
    </div>
  );
}

export default Dashboard;
