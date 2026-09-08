import { useEffect, useRef, useState } from "react";
import { createConnectionCode } from "../../../lib/serverConnection";

export default function ServerSharing({ projectId }: { projectId: string }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const codeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    window.electron
      ?.readFirebaseConfig?.()
      .then((config) => {
        if (!cancelled && config) setCode(createConnectionCode(config));
      })
      .catch(() => {
        if (!cancelled) setMessage("The connection code could not be created.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Connection code copied.");
    } catch {
      codeRef.current?.focus();
      codeRef.current?.select();
      setMessage("The code is selected. Press Ctrl+C or Command+C to copy it.");
    }
  };

  return (
    <div
      data-testid="server-sharing"
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid #b8d8e5",
        borderRadius: 8,
        background: "#f2f9fc",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#333" }}>
        Share this server
      </h3>
      <p className="backend-copy" style={{ marginTop: 0 }}>
        Send this code to anyone who should use this server. They can paste it
        into ExpBuilder and create their own account.
      </p>
      <p className="backend-copy">
        Server: <strong>{projectId}</strong>
      </p>
      {code ? (
        <>
          <textarea
            ref={codeRef}
            aria-label="Server connection code"
            readOnly
            value={code}
            rows={3}
            spellCheck={false}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #b0bec5",
              borderRadius: 6,
              boxSizing: "border-box",
              resize: "none",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="token-button connect"
            style={{ marginTop: 10 }}
          >
            Copy connection code
          </button>
        </>
      ) : null}
      {message ? (
        <div
          role="status"
          style={{ color: "#555", fontSize: 13, marginTop: 8 }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
