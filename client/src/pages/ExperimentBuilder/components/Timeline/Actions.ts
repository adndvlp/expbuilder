import { Dispatch, SetStateAction, useEffect } from "react";
import useDevMode from "../../hooks/useDevMode";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  lastPagesUrl: string;
  isTunnelActive: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  generateLocalExperiment: () => Promise<string>;
  generatedBaseCode: () => Promise<string>;
  setSubmitStatus: Dispatch<SetStateAction<string>>;
  setExperimentUrl: (url: string) => void;
  setCopyStatus: Dispatch<SetStateAction<string>>;
  setTunnelStatus: Dispatch<SetStateAction<string>>;
  setTunnelActive: Dispatch<SetStateAction<boolean>>;
  setIsTunnelCreating: Dispatch<SetStateAction<boolean>>;
  setActiveTunnelUrl: Dispatch<SetStateAction<string>>;
  setLastPagesUrl: Dispatch<SetStateAction<string>>;
};

export default function Actions({
  experimentID,
  lastPagesUrl,
  isTunnelActive,
  setIsSubmitting,
  generateLocalExperiment,
  generatedBaseCode,
  setSubmitStatus,
  setExperimentUrl,
  setCopyStatus,
  setTunnelStatus,
  setTunnelActive,
  setIsTunnelCreating,
  setActiveTunnelUrl,
  setLastPagesUrl,
}: Props) {
  const { isDevMode, setCode } = useDevMode();
  const handleRunExperiment = async () => {
    setIsSubmitting(true);

    try {
      const generatedLocalCode = await generateLocalExperiment();

      if (!isDevMode) {
        setSubmitStatus("Saving configuration...");

        setCode(await generatedBaseCode());

        const config = {
          generatedCode: generatedLocalCode, // Código local para ejecutar
        };

        // Paso 1: Guarda la configuración
        const response = await fetch(
          `${API_URL}/api/save-config/${experimentID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config, isDevMode }),
            credentials: "include",
            mode: "cors",
          },
        );

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
          setSubmitStatus("Failed to save configuration.");
          setIsSubmitting(false);
          return;
        }

        setSubmitStatus("Saved Configuration! Building experiment...");
      }

      // Paso 2: Llama al build/run-experiment con código LOCAL
      setSubmitStatus("Running experiment...");
      const runResponse = await fetch(
        `${API_URL}/api/run-experiment/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedCode: generatedLocalCode }),
          credentials: "include",
          mode: "cors",
        },
      );

      if (!runResponse.ok) {
        throw new Error(
          `Server responded with status: ${runResponse.status} when running experiment`,
        );
      }

      const runResult = await runResponse.json();
      if (runResult.success) {
        // setExperimentUrl(result.urlExperiment);
        setSubmitStatus("Experiment ready!");
        // window.alert("Experiment ready!");
        setSubmitStatus("");

        // window.open(runResult.experimentUrl, "_blank"); // <--- ABRE AUTOMÁTICAMENTE
      } else {
        setSubmitStatus(
          "Saved configuration but failed at running the experiment.",
        );
        window.alert(
          "Saved configuration but failed at running the experiment.",
        );
      }
    } catch (error) {
      console.error("Error submitting configuration:", error);
      setSubmitStatus(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setIsSubmitting(false);
      // console.log(generateExperiment());
    }
  };

  const handleShareLocalExperiment = async () => {
    const confirm = window.confirm(
      "Warning: All your local experiments will be public until you close the tunnel or exit the app. Anyone with a link can access them.",
    );
    if (!confirm) return;
    setIsTunnelCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/create-tunnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentID }),
      });

      const data = await res.json();
      if (data.success) {
        setExperimentUrl(`${data.url}/${experimentID}`);
        setActiveTunnelUrl(data.url);
        // Persist tunnel state in localStorage (global, not per experiment)
        localStorage.setItem("tunnelActive", "true");
        localStorage.setItem("tunnelUrl", data.url);
        const url = `${data.url}/${experimentID}`;
        try {
          await navigator.clipboard.writeText(url);
          setTunnelStatus("Tunnel active — link copied to clipboard");
        } catch (err) {
          console.error("Failed to copy public link: ", err);
          setTunnelStatus("Tunnel active");
        }
        setTunnelActive(true);
        setTimeout(() => setTunnelStatus(""), 4000);
        return url;
      } else {
        console.error("Error creating tunnel:", data.error);
        setTunnelStatus(`Failed: ${data.error || "Unknown error"}`);
        setTimeout(() => setTunnelStatus(""), 5000);
      }
    } catch (error) {
      console.error("Connection error:", error);
      setTunnelStatus(
        `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setTimeout(() => setTunnelStatus(""), 5000);
    } finally {
      setIsTunnelCreating(false);
    }
  };

  const handleCloseTunnel = async () => {
    const confirm = window.confirm(
      "Stop sharing your local experiment? Participants won't be able to access it until you reopen the tunnel. Collected results will not be lost.",
    );
    if (!confirm) return;
    try {
      const res = await fetch(`${API_URL}/api/close-tunnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentID }),
      });
      const data = await res.json();

      setExperimentUrl(`${API_URL}/${experimentID}`);
      setActiveTunnelUrl("");
      setTunnelActive(false);
      localStorage.removeItem("tunnelActive");
      localStorage.removeItem("tunnelUrl");
      if (data.success) {
        setTunnelStatus(data.message);
      } else {
        setTunnelStatus("Error closing tunnel");
        console.error(data.message);
      }
      setTimeout(() => setTunnelStatus(""), 2000);
    } catch (err) {
      console.error("Error closing tunnel:", err);
    }
  };
  // Restore tunnel state and load saved URLs from DB on mount
  useEffect(() => {
    const tunnelActive = localStorage.getItem("tunnelActive") === "true";
    const tunnelUrl = localStorage.getItem("tunnelUrl");
    if (tunnelActive && tunnelUrl) {
      setTunnelActive(true);
      setExperimentUrl(`${tunnelUrl}/${experimentID}`);
    }
    if (!experimentID) return;
    fetch(`${API_URL}/api/experiment/${experimentID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.experiment) {
          if (data.experiment.tunnelUrl) {
            setActiveTunnelUrl(data.experiment.tunnelUrl);
          } else {
            // Server restarted — tunnel is gone, clear stale state
            setActiveTunnelUrl("");
            setTunnelActive(false);
            localStorage.removeItem("tunnelActive");
            localStorage.removeItem("tunnelUrl");
          }
          if (data.experiment.pagesUrl) {
            setLastPagesUrl(data.experiment.pagesUrl);
          }
        }
      })
      .catch(console.error);
  }, [
    experimentID,
    setExperimentUrl,
    setActiveTunnelUrl,
    setLastPagesUrl,
    setTunnelActive,
  ]);

  const handleCopyLink = async () => {
    let linkToCopy = "";
    // Prioridad: el último link publicado (GitHub Pages) si existe
    if (lastPagesUrl) {
      linkToCopy = lastPagesUrl;
    } else if (isTunnelActive && experimentID) {
      const tunnelUrl = localStorage.getItem("tunnelUrl");
      if (tunnelUrl) {
        linkToCopy = `${tunnelUrl}/${experimentID}`;
      }
    }
    if (linkToCopy) {
      try {
        await navigator.clipboard.writeText(linkToCopy);
        setCopyStatus("Link copied!");
        setTimeout(() => setCopyStatus(""), 2000); // Clear message after 2 seconds
      } catch (err) {
        console.error("Failed to copy: ", err);
        setCopyStatus("Failed to copy link.");
      }
    } else {
      setCopyStatus("No published link available.");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };
  return {
    handleRunExperiment,
    handleShareLocalExperiment,
    handleCloseTunnel,
    handleCopyLink,
  };
}
