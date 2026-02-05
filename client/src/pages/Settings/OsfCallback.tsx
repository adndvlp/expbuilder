import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function OsfCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get("success");
      const error = searchParams.get("error");
      const provider = searchParams.get("provider");

      if (!provider || provider !== "osf") {
        setStatus("error");
        setMessage("Invalid callback parameters");
        setTimeout(() => navigate("/settings"), 3000);
        return;
      }

      if (error === "access_denied") {
        setStatus("error");
        setMessage("Access denied by user");
        setTimeout(
          () =>
            navigate(
              "/settings?status=error&service=osf&message=Access denied",
            ),
          2000,
        );
        return;
      }

      if (error) {
        setStatus("error");
        setMessage(`Error: ${error}`);
        setTimeout(
          () =>
            navigate(
              `/settings?status=error&service=osf&message=${encodeURIComponent(error)}`,
            ),
          2000,
        );
        return;
      }

      if (success === "true") {
        // Verificar que los tokens se guardaron correctamente
        const user = auth.currentUser;
        if (user) {
          try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const data = docSnap.data();
              const hasOAuthToken = !!data.osfTokens?.access_token;

              if (hasOAuthToken) {
                setStatus("success");
                setMessage("OSF connected successfully!");
                setTimeout(
                  () => navigate("/settings?status=success&service=osf"),
                  2000,
                );
                return;
              }
            }
          } catch (err) {
            console.error("Error verifying OSF tokens:", err);
          }
        }

        // Si llegamos aquí, algo salió mal pero el callback reportó éxito
        setStatus("error");
        setMessage("Failed to verify OSF connection");
        setTimeout(
          () =>
            navigate(
              "/settings?status=error&service=osf&message=Verification failed",
            ),
          2000,
        );
        return;
      }

      // Si no hay success ni error, algo está mal
      setStatus("error");
      setMessage("Invalid callback state");
      setTimeout(() => navigate("/settings"), 3000);
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        padding: 20,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 40,
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                width: 50,
                height: 50,
                border: "4px solid #f3f3f3",
                borderTop: "4px solid #3d92b4",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <h2 style={{ color: "#333", marginBottom: 10 }}>
              Connecting to OSF...
            </h2>
            <p style={{ color: "#666" }}>
              Please wait while we complete the connection.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                backgroundColor: "#4caf50",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <span style={{ color: "white", fontSize: 30 }}>✓</span>
            </div>
            <h2 style={{ color: "#4caf50", marginBottom: 10 }}>Success!</h2>
            <p style={{ color: "#666" }}>{message}</p>
            <p style={{ color: "#999", fontSize: 14, marginTop: 10 }}>
              Redirecting...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                backgroundColor: "#f44336",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <span style={{ color: "white", fontSize: 30 }}>✗</span>
            </div>
            <h2 style={{ color: "#f44336", marginBottom: 10 }}>Error</h2>
            <p style={{ color: "#666" }}>{message}</p>
            <p style={{ color: "#999", fontSize: 14, marginTop: 10 }}>
              Redirecting to settings...
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
