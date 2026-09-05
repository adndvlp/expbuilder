import {
  OAUTH_CALLBACK_URI,
  PROVIDER_CONSOLE_URLS,
  PROVIDER_KEYS,
  PROVIDER_LABELS,
  type BackendOAuthState,
} from "../../../lib/backendSetup";
import { openExternal } from "../../../lib/openExternal";

interface PublishingAccountsProps {
  oauth: BackendOAuthState;
  onToggle: (key: keyof BackendOAuthState) => void;
  onChange: (
    key: keyof BackendOAuthState,
    field: "clientId" | "clientSecret",
    value: string,
  ) => void;
}

export default function PublishingAccounts({
  oauth,
  onToggle,
  onChange,
}: PublishingAccountsProps) {
  return (
    <details className="backend-details">
      <summary>Add publishing later (GitHub, Dropbox, Drive, OSF)</summary>
      <p className="backend-copy" style={{ marginTop: 12 }}>
        Only if you publish experiments there. Use this callback:{" "}
        <code>{OAUTH_CALLBACK_URI}</code>
      </p>
      <div className="tokens-list">
        {PROVIDER_KEYS.map((key) => (
          <div key={key} className="token-item backend-provider">
            <div className="token-info">
              <input
                type="checkbox"
                className="backend-check"
                checked={oauth[key].enabled}
                onChange={() => onToggle(key)}
                aria-label={PROVIDER_LABELS[key]}
              />
              <span className="token-name">{PROVIDER_LABELS[key]}</span>
              <a
                href={PROVIDER_CONSOLE_URLS[key]}
                onClick={(event) => {
                  event.preventDefault();
                  openExternal(PROVIDER_CONSOLE_URLS[key]);
                }}
              >
                open console
              </a>
            </div>
            {oauth[key].enabled ? (
              <div className="backend-provider-fields">
                <input
                  type="text"
                  value={oauth[key].clientId}
                  onChange={(event) =>
                    onChange(key, "clientId", event.target.value)
                  }
                  placeholder={`${PROVIDER_LABELS[key]} Client ID`}
                />
                <input
                  type="text"
                  value={oauth[key].clientSecret}
                  onChange={(event) =>
                    onChange(key, "clientSecret", event.target.value)
                  }
                  placeholder={`${PROVIDER_LABELS[key]} Client Secret`}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}
