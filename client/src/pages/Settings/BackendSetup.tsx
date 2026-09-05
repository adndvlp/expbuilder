import { openExternal } from "../../lib/openExternal";
import PublishingAccounts from "./backend/PublishingAccounts";
import { useBackendSetup } from "./backend/useBackendSetup";

const inputStyle = { padding: "6px 10px", flex: 1 } as const;

export default function BackendSetup() {
  const setup = useBackendSetup();

  if (!setup.isElectron) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: 8,
          color: "#856404",
          fontSize: 14,
        }}
      >
        Server setup is only available in the Electron app.
      </div>
    );
  }

  if (!setup.ready) {
    return <p className="backend-copy">Loading saved server…</p>;
  }

  const showSignIn = !setup.token && !setup.deployed;
  const showResumeSignIn = setup.deployed && !setup.token;
  const showProject = Boolean(setup.token && !setup.configSaved);
  const showBilling = Boolean(setup.configSaved && !setup.billingDone);
  const showDatabase = Boolean(setup.billingDone && !setup.firestoreDone);
  const showFinish = Boolean(setup.firestoreDone && !setup.deployed);
  const hasBillingAccounts = setup.billingAccounts.length > 0;

  return (
    <div className="backend-setup" style={{ marginTop: 8 }}>
      <p className="backend-copy">
        ExpBuilder will create a private server on your Google account. You
        need a Google account. Google may ask for a payment card; typical lab
        use stays within the free quota.
      </p>
      <p className="backend-status">{setup.status}</p>
      {setup.deployed ? (
        <p className="backend-copy">{setup.publishingNote}</p>
      ) : null}

      {(showSignIn || showResumeSignIn) && (
        <div className="backend-row">
          {showResumeSignIn ? (
            <p className="backend-copy">
              Sign in with Google to add or change publishing accounts.
            </p>
          ) : null}
          <button
            onClick={setup.startLogin}
            disabled={setup.running}
            className="token-button connect"
          >
            Continue with Google
          </button>
          {setup.loginUrl && (
            <>
              <button
                onClick={() => openExternal(setup.loginUrl)}
                className="token-button"
                style={{ background: "#3d92b4", color: "white" }}
              >
                Open Google sign-in
              </button>
              <input
                type="text"
                value={setup.loginCode}
                onChange={(event) => setup.setLoginCode(event.target.value)}
                placeholder="If Google showed a code, paste it here"
                style={inputStyle}
              />
              <button
                onClick={setup.submitLoginCode}
                disabled={!setup.loginCode.trim()}
                className="token-button"
                style={{ background: "#6c757d", color: "white" }}
              >
                Submit code
              </button>
            </>
          )}
        </div>
      )}

      {showProject && (
        <div className="backend-row" data-testid="backend-step-project">
          {!setup.projectDone && (
            <>
              <select
                value={setup.projectMode}
                onChange={(event) =>
                  setup.setProjectMode(event.target.value as "create" | "use")
                }
                style={{ padding: "6px 10px" }}
              >
                <option value="create">Create a new server</option>
                <option value="use">Use an existing project</option>
              </select>
              {setup.projectMode === "create" ? (
                <input
                  type="text"
                  value={setup.projectId}
                  onChange={(event) => setup.setProjectId(event.target.value)}
                  placeholder="Project name (for example my-lab)"
                  style={inputStyle}
                />
              ) : (
                <select
                  value={setup.projectId}
                  onChange={(event) => setup.setProjectId(event.target.value)}
                  style={{ padding: "6px 10px", flex: 1 }}
                  aria-label="Existing Google project"
                >
                  <option value="">Select a project</option>
                  {setup.projects.map((project) => (
                    <option key={project.projectId} value={project.projectId}>
                      {project.displayName && project.displayName !== project.projectId
                        ? `${project.displayName} (${project.projectId})`
                        : project.projectId}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <button
            onClick={setup.handleSetup}
            disabled={
              setup.running || (!setup.projectDone && !setup.projectId.trim())
            }
            className="token-button connect"
          >
            Set up my server
          </button>
        </div>
      )}

      {showBilling && (
        <div data-testid="backend-step-billing">
          {hasBillingAccounts ? (
            <>
              <p className="backend-copy">
                Link a billing account you already have. Typical lab use stays in
                the free quota.
              </p>
              <div className="backend-row">
                <select
                  value={setup.selectedBilling}
                  onChange={(event) => setup.setSelectedBilling(event.target.value)}
                  style={{ padding: "6px 10px", flex: 1 }}
                  aria-label="Billing account"
                >
                  <option value="">Select a billing account</option>
                  {setup.billingAccounts.map((account) => (
                    <option key={account.name} value={account.name}>
                      {account.displayName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={setup.handleLinkBilling}
                  disabled={setup.running || !setup.selectedBilling}
                  className="token-button connect"
                >
                  Link billing account
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="backend-copy">
                Google may ask you to add a billing account. Typical lab use stays
                in the free quota. Open the billing page, then come back and
                continue.
              </p>
              <div className="backend-row">
                <button
                  onClick={() => setup.openConsole("/settings/usage")}
                  disabled={setup.running}
                  className="token-button"
                  style={{ background: "#3d92b4", color: "white" }}
                >
                  Open billing page
                </button>
                <button
                  onClick={setup.handleBillingContinue}
                  disabled={setup.running}
                  className="token-button connect"
                  aria-label="Continue after billing"
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showDatabase && (
        <div className="backend-row" data-testid="backend-step-database">
          {setup.running ? (
            <p className="backend-copy">Setting up the database…</p>
          ) : (
            <button
              onClick={setup.handleFirestore}
              className="token-button connect"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {showFinish && (
        <div data-testid="backend-step-finish">
          {setup.googleAuthNeedsConsole ? (
            <p className="backend-copy">
              Email/password is on. Turn on Google on the sign-in page if you
              want Google login.
            </p>
          ) : null}
          <PublishingAccounts
            oauth={setup.oauth}
            onToggle={setup.toggleProvider}
            onChange={setup.updateProvider}
          />
          <div className="backend-row" style={{ marginTop: 12 }}>
            <button
              onClick={setup.handleFinish}
              disabled={setup.running}
              className="token-button connect"
            >
              Finish setup
            </button>
          </div>
        </div>
      )}

      {setup.deployed && setup.token ? (
        <div data-testid="backend-publishing">
          <PublishingAccounts
            oauth={setup.oauth}
            onToggle={setup.toggleProvider}
            onChange={setup.updateProvider}
          />
          <div className="backend-row" style={{ marginTop: 12 }}>
            <button
              onClick={setup.handleFinish}
              disabled={setup.running || !setup.publishingDirty}
              className="token-button connect"
            >
              Save publishing credentials
            </button>
          </div>
          {!setup.publishingDirty ? (
            <p className="backend-copy">
              Change a publishing account to save again.
            </p>
          ) : null}
        </div>
      ) : null}

      {setup.error && <div className="backend-error">{setup.error}</div>}

      {setup.logs.trim() ? (
        <details className="backend-details">
          <summary>Technical details</summary>
          <pre className="backend-log">{setup.logs}</pre>
        </details>
      ) : null}
    </div>
  );
}
