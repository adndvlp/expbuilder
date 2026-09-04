import {
  readBackendSetupState,
  writeBackendSetupState,
} from "./backend-setup.js";

export const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
export const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const tokenCache = new Map();

export async function getAccessToken(refreshToken) {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.accessToken;
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      data.error_description || data.error || "Could not refresh Google access token",
    );
  }
  tokenCache.set(refreshToken, {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  });
  return data.access_token;
}

export async function googleJson(accessToken, url, options = {}) {
  const { method = "GET", body, projectId } = options;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (projectId) headers["x-goog-user-project"] = projectId;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const message =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      text ||
      `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function ensureService(accessToken, projectId, service) {
  try {
    await googleJson(
      accessToken,
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}:enable`,
      { method: "POST", projectId },
    );
  } catch (error) {
    if (error.status !== 409 && !/already enabled|ALREADY_EXISTS/i.test(error.message)) {
      throw error;
    }
  }
}

export async function listFirebaseProjects(accessToken) {
  const projects = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const data = await googleJson(
      accessToken,
      `https://firebase.googleapis.com/v1beta1/projects?${query}`,
    );
    for (const project of data?.results || []) {
      projects.push({
        projectId: project.projectId,
        displayName: project.displayName || project.projectId,
        projectNumber: project.projectNumber,
      });
    }
    pageToken = data?.nextPageToken || "";
  } while (pageToken);
  return projects;
}

export async function checkBillingEnabled(accessToken, projectId) {
  await ensureService(accessToken, projectId, "cloudbilling.googleapis.com");
  const data = await googleJson(
    accessToken,
    `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
    { projectId },
  );
  return Boolean(data?.billingEnabled);
}

export async function listBillingAccounts(accessToken, projectId) {
  if (projectId) {
    await ensureService(accessToken, projectId, "cloudbilling.googleapis.com");
  }
  const data = await googleJson(
    accessToken,
    "https://cloudbilling.googleapis.com/v1/billingAccounts",
    { projectId },
  );
  return (data?.billingAccounts || []).map((account) => ({
    name: account.name,
    displayName: account.displayName || account.name,
    open: account.open !== false,
  }));
}

export async function linkBillingAccount(accessToken, projectId, billingAccountName) {
  await ensureService(accessToken, projectId, "cloudbilling.googleapis.com");
  const data = await googleJson(
    accessToken,
    `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
    {
      method: "PUT",
      projectId,
      body: { billingAccountName },
    },
  );
  return Boolean(data?.billingEnabled);
}

async function enableEmailPassword(accessToken, projectId) {
  await ensureService(accessToken, projectId, "identitytoolkit.googleapis.com");
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await googleJson(
        accessToken,
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email`,
        {
          method: "PATCH",
          projectId,
          body: { signIn: { email: { enabled: true, passwordRequired: true } } },
        },
      );
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function getProjectNumber(accessToken, projectId) {
  const data = await googleJson(
    accessToken,
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
  );
  return data?.projectNumber || "";
}

async function findOrCreateGoogleOauthClient(accessToken, projectId, projectNumber) {
  try {
    const listed = await googleJson(
      accessToken,
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs`,
      { projectId },
    );
    const existing = (listed?.defaultSupportedIdpConfigs || []).find((config) =>
      String(config.name || "").includes("google.com"),
    );
    if (existing?.enabled) return { alreadyEnabled: true };
    if (existing?.clientId) {
      return { clientId: existing.clientId, clientSecret: existing.clientSecret };
    }
  } catch {
    // Identity Toolkit may not be ready yet.
  }
  if (!projectNumber) return null;
  try {
    await ensureService(accessToken, projectId, "iap.googleapis.com");
    const user = await googleJson(accessToken, "https://www.googleapis.com/oauth2/v2/userinfo");
    let brands = await googleJson(
      accessToken,
      `https://iap.googleapis.com/v1/projects/${projectNumber}/brands`,
    );
    let brand = (brands?.brands || [])[0];
    if (!brand && user?.email) {
      brand = await googleJson(
        accessToken,
        `https://iap.googleapis.com/v1/projects/${projectNumber}/brands`,
        {
          method: "POST",
          projectId,
          body: { applicationTitle: "ExpBuilder", supportEmail: user.email },
        },
      );
    }
    if (!brand?.name) return null;
    const clients = await googleJson(
      accessToken,
      `https://iap.googleapis.com/v1/${brand.name}/identityAwareProxyClients`,
    );
    const existingClient = (clients?.identityAwareProxyClients || [])[0];
    const client =
      existingClient ||
      (await googleJson(
        accessToken,
        `https://iap.googleapis.com/v1/${brand.name}/identityAwareProxyClients`,
        { method: "POST", projectId, body: { displayName: "ExpBuilder" } },
      ));
    const clientId = String(client?.name || "").split("/").pop();
    if (!clientId || !client?.secret) return null;
    return { clientId, clientSecret: client.secret };
  } catch {
    return null;
  }
}

export async function enableAuthProviders(accessToken, projectId) {
  await enableEmailPassword(accessToken, projectId);
  try {
    const listed = await googleJson(
      accessToken,
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs`,
      { projectId },
    );
    const existing = (listed?.defaultSupportedIdpConfigs || []).find((config) =>
      String(config.name || "").includes("google.com"),
    );
    if (existing) {
      if (!existing.enabled) {
        await googleJson(
          accessToken,
          `https://identitytoolkit.googleapis.com/admin/v2/${existing.name}?updateMask=enabled`,
          { method: "PATCH", projectId, body: { enabled: true } },
        );
      }
      return { emailEnabled: true, googleEnabled: true, googleNeedsConsole: false };
    }
    const projectNumber = await getProjectNumber(accessToken, projectId);
    const oauth = await findOrCreateGoogleOauthClient(
      accessToken,
      projectId,
      projectNumber,
    );
    if (oauth?.alreadyEnabled) {
      return { emailEnabled: true, googleEnabled: true, googleNeedsConsole: false };
    }
    if (oauth?.clientId && oauth?.clientSecret) {
      await googleJson(
        accessToken,
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`,
        {
          method: "POST",
          projectId,
          body: {
            enabled: true,
            clientId: oauth.clientId,
            clientSecret: oauth.clientSecret,
          },
        },
      );
      return { emailEnabled: true, googleEnabled: true, googleNeedsConsole: false };
    }
  } catch {
    // Email/password is enough to continue; Google can be turned on in the console.
  }
  return { emailEnabled: true, googleEnabled: false, googleNeedsConsole: true };
}

export async function handleBackendSetupApi(payload, statePath) {
  const { action, token, projectId, billingAccountName, state } = payload || {};
  try {
    if (action === "readState") {
      return { success: true, state: readBackendSetupState(statePath) };
    }
    if (action === "writeState") {
      writeBackendSetupState(statePath, state);
      return { success: true };
    }
    const needsToken = [
      "listProjects",
      "checkBilling",
      "listBillingAccounts",
      "linkBilling",
      "enableAuth",
    ];
    if (!needsToken.includes(action)) {
      return { success: false, error: `Unknown action: ${action}` };
    }
    if (!token) {
      return { success: false, error: "Not signed in with Google" };
    }
    const accessToken = await getAccessToken(token);
    if (action === "listProjects") {
      return { success: true, projects: await listFirebaseProjects(accessToken) };
    }
    if (action === "checkBilling") {
      return {
        success: true,
        enabled: await checkBillingEnabled(accessToken, projectId),
      };
    }
    if (action === "listBillingAccounts") {
      return {
        success: true,
        accounts: await listBillingAccounts(accessToken, projectId),
      };
    }
    if (action === "linkBilling") {
      return {
        success: true,
        enabled: await linkBillingAccount(accessToken, projectId, billingAccountName),
      };
    }
    const result = await enableAuthProviders(accessToken, projectId);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message || "Google API request failed" };
  }
}
