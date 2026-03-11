import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

type Provider = "cloudflared" | "ngrok";

type Props = {
  experimentID: string | undefined;
};

function CustomDomainSettings({ experimentID }: Props) {
  const [provider, setProvider] = useState<Provider>("cloudflared");
  const [hostname, setHostname] = useState("");
  const [ngrokAuthtoken, setNgrokAuthtoken] = useState("");
  const [ngrokDomain, setNgrokDomain] = useState("");
  const [persistent, setPersistent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!experimentID) return;
    fetch(`${API_URL}/api/tunnel-settings/${experimentID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          setProvider((data.settings.provider as Provider) ?? "cloudflared");
          setHostname(data.settings.hostname ?? "");
          setNgrokAuthtoken(data.settings.ngrokAuthtoken ?? "");
          setNgrokDomain(data.settings.ngrokDomain ?? "");
          setPersistent(data.settings.persistent ?? false);
        }
      })
      .catch((err) => console.error("Error loading tunnel settings:", err));
  }, [experimentID]);

  const hasPersistentConfig =
    provider === "cloudflared"
      ? !!hostname.trim()
      : !!(ngrokAuthtoken.trim() && ngrokDomain.trim());

  const handleSave = async () => {
    if (!experimentID) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/tunnel-settings/${experimentID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            hostname: hostname
              .trim()
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, ""),
            ngrokAuthtoken: ngrokAuthtoken.trim(),
            ngrokDomain: ngrokDomain
              .trim()
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, ""),
            persistent: hasPersistentConfig ? persistent : false,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setProvider(data.settings.provider ?? "cloudflared");
        setHostname(data.settings.hostname);
        setNgrokAuthtoken(data.settings.ngrokAuthtoken ?? "");
        setNgrokDomain(data.settings.ngrokDomain ?? "");
        setPersistent(data.settings.persistent);
        setMessage({ type: "success", text: "Settings saved!" });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Error saving settings.",
        });
      }
    } catch (err) {
      console.error("Error saving tunnel settings:", err);
      setMessage({ type: "error", text: "Error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!experimentID) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/tunnel-settings/${experimentID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "cloudflared",
            hostname: "",
            ngrokAuthtoken: "",
            ngrokDomain: "",
            persistent: false,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setProvider("cloudflared");
        setHostname("");
        setNgrokAuthtoken("");
        setNgrokDomain("");
        setPersistent(false);
        setMessage({ type: "success", text: "Settings cleared." });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Error clearing settings.",
        });
      }
    } catch (err) {
      console.error("Error clearing tunnel settings:", err);
      setMessage({ type: "error", text: "Error clearing settings." });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: 10,
    fontSize: 14,
    border: "2px solid var(--neutral-mid)",
    borderRadius: 6,
    width: "340px",
    backgroundColor: "var(--neutral-light)",
    color: "var(--text-dark)",
    fontFamily: "monospace",
  };

  const providerBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 18px",
    borderRadius: 6,
    border: `2px solid ${active ? "var(--primary-blue)" : "var(--neutral-mid)"}`,
    backgroundColor: active ? "var(--primary-blue)" : "transparent",
    color: active ? "#fff" : "var(--text-dark)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  });

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}>
        Tunnel Settings
      </h2>

      {/* Provider selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          style={providerBtnStyle(provider === "cloudflared")}
          onClick={() => setProvider("cloudflared")}
        >
          Cloudflare
        </button>
        <button
          style={providerBtnStyle(provider === "ngrok")}
          onClick={() => setProvider("ngrok")}
        >
          ngrok
        </button>
      </div>

      {/* ── Cloudflare section ───────────────────────────────────────────── */}
      {provider === "cloudflared" && (
        <>
          <p
            style={{
              color: "var(--text-dark)",
              fontSize: 14,
              opacity: 0.8,
              marginBottom: 8,
            }}
          >
            Use a domain on Cloudflare for a fixed URL when sharing local
            experiments. Leave blank to get a random{" "}
            <code>*.trycloudflare.com</code> URL each time.
          </p>
          <p
            style={{
              color: "var(--text-dark)",
              fontSize: 13,
              opacity: 0.65,
              marginBottom: 16,
            }}
          >
            Requirements: the domain must be in a Cloudflare-managed DNS zone
            and <code>cloudflared tunnel login</code> must have been run on this
            machine. See the{" "}
            <a
              href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--primary-blue)" }}
            >
              Cloudflare Tunnel docs
            </a>
            .
          </p>
          <label
            htmlFor="tunnelHostname"
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-dark)",
              marginBottom: 6,
            }}
          >
            Hostname{" "}
            <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 13 }}>
              (e.g. experiment.yourdomain.com)
            </span>
          </label>
          <input
            id="tunnelHostname"
            type="text"
            placeholder="experiment.yourdomain.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            style={inputStyle}
          />
        </>
      )}

      {/* ── ngrok section ────────────────────────────────────────────────── */}
      {provider === "ngrok" && (
        <>
          <p
            style={{
              color: "var(--text-dark)",
              fontSize: 14,
              opacity: 0.8,
              marginBottom: 8,
            }}
          >
            Use ngrok with your free static domain for a persistent, fixed URL.
            Get your authtoken and static domain from your{" "}
            <a
              href="https://dashboard.ngrok.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--primary-blue)" }}
            >
              ngrok dashboard
            </a>
            .
          </p>
          <p
            style={{
              color: "var(--text-dark)",
              fontSize: 13,
              opacity: 0.65,
              marginBottom: 16,
            }}
          >
            Your authtoken is stored locally and never sent anywhere other than
            ngrok's servers to authenticate your tunnel.
          </p>

          <label
            htmlFor="ngrokDomain"
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-dark)",
              marginBottom: 6,
            }}
          >
            Static domain{" "}
            <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 13 }}>
              (e.g. xyz-abc.ngrok-free.app)
            </span>
          </label>
          <input
            id="ngrokDomain"
            type="text"
            placeholder="xyz-abc.ngrok-free.app"
            value={ngrokDomain}
            onChange={(e) => setNgrokDomain(e.target.value)}
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label
            htmlFor="ngrokAuthtoken"
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-dark)",
              marginBottom: 6,
            }}
          >
            Authtoken
          </label>
          <input
            id="ngrokAuthtoken"
            type="password"
            placeholder="2abc...XYZ"
            value={ngrokAuthtoken}
            onChange={(e) => setNgrokAuthtoken(e.target.value)}
            style={inputStyle}
          />
        </>
      )}

      {/* Persistent toggle — shown when required fields are filled */}
      {hasPersistentConfig && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
          }}
        >
          <input
            type="checkbox"
            id="tunnelPersistent"
            checked={persistent}
            onChange={(e) => setPersistent(e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          <label
            htmlFor="tunnelPersistent"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-dark)",
              cursor: "pointer",
            }}
          >
            Keep tunnel always on
          </label>
          <span
            style={{ fontSize: 13, color: "var(--text-dark)", opacity: 0.65 }}
          >
            — tunnel starts automatically when the app boots
          </span>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="gradient-btn"
          style={{
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {(hostname || ngrokDomain || ngrokAuthtoken) && (
          <button
            onClick={handleClear}
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "2px solid var(--neutral-mid)",
              backgroundColor: "transparent",
              color: "var(--text-dark)",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 14,
              opacity: saving ? 0.6 : 1,
            }}
          >
            Clear
          </button>
        )}
        {message && (
          <p
            style={{
              color: message.type === "success" ? "#4caf50" : "#f44336",
              fontWeight: 600,
              fontSize: 14,
              margin: 0,
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default CustomDomainSettings;
