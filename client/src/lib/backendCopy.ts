import {
  PROVIDER_KEYS,
  PROVIDER_LABELS,
  type BackendOAuthState,
} from "./backendSetup";

export function setupStatus(state: {
  deployed: boolean;
  running: boolean;
  firestoreDone: boolean;
  billingDone: boolean;
  configSaved: boolean;
  token: string;
  projectId: string;
}): string {
  if (state.deployed) {
    return `Connected to ${state.projectId}.`;
  }
  if (state.firestoreDone) return "Server is ready to deploy.";
  if (state.billingDone) return "Setting up the database…";
  if (state.configSaved) return "Billing is needed to finish setup.";
  if (state.token) return "Signed in with Google";
  return "Not connected";
}

export function publishingSummary(oauth: BackendOAuthState): string {
  const configured = PROVIDER_KEYS.filter(
    (key) => oauth[key].enabled && oauth[key].clientId,
  ).map((key) => PROVIDER_LABELS[key]);
  const missing = PROVIDER_KEYS.filter(
    (key) => !(oauth[key].enabled && oauth[key].clientId),
  ).map((key) => PROVIDER_LABELS[key]);
  if (configured.length === 0) {
    return "Publishing is not set up yet. Add GitHub, Dropbox, Drive, or OSF later if you need them.";
  }
  if (missing.length === 0) {
    return `Publishing is set up: ${configured.join(", ")}.`;
  }
  return `${configured.join(", ")} ready. Still to set up: ${missing.join(", ")}.`;
}
