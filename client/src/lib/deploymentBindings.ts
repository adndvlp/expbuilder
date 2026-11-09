import { auth } from "./firebase";
import { getApiBaseUrl } from "./apiBaseUrl";
export type StorageProvider = "googledrive" | "dropbox" | "osf";
export type StorageBinding = {
  provider: StorageProvider;
  accountId: string;
  folderId: string;
  folderPath?: string;
  rootFolderId?: string;
  accountLabel?: string;
  folderName?: string;
};
export type GithubBinding = {
  accountLogin?: string;
  repositoryId: string;
  accountId: string;
  ownerLogin: string;
  repoName: string;
  branch: string;
  isPrivate?: boolean;
};
export type DeploymentContext = {
  success: true;
  exists: boolean;
  projectId: string;
  experimentID: string;
  verifiedOwnerUid: string;
  storage: {
    state: "new" | "bound" | "needs_confirmation";
    provider?: StorageProvider;
    binding?: StorageBinding;
  };
  github: {
    state: "new" | "bound" | "needs_selection";
    binding?: GithubBinding;
    suggestedRepository?: string;
  };
  pendingRepair?: {
    resource: "storage" | "github";
    suggestedRepository?: string;
    suggestedFolder?: string;
  };
  repairResult?: {
    resource: "storage" | "github";
    requiresPublication?: boolean;
    urlMayChange?: boolean;
  };
};
export type BindingSelection = {
  repository?: string;
  branch?: string;
  storageFolder?: string;
};
export type BindingPreview = {
  contextFingerprint: string;
  fingerprint: string;
  selection: BindingSelection;
  storage: StorageBinding;
  github: GithubBinding | null;
};
export type RepairPreview = {
  kind: "repair";
  resource: "storage" | "github";
  accountId: string;
  accountLabel?: string;
  previous: Partial<StorageBinding & GithubBinding>;
  replacement?: Partial<StorageBinding & GithubBinding>;
  selection: BindingSelection;
  contextFingerprint: string;
  fingerprint: string;
};
export class BindingRequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export async function deploymentRequest(
  experimentID: string | undefined,
  action:
    | "context"
    | "inspect"
    | "confirm"
    | "repair/inspect"
    | "repair/confirm",
  body: unknown = {},
): Promise<
  DeploymentContext & {
    preview?: BindingPreview;
    repairPreview?: RepairPreview;
    repairResult?: {
      resource: "storage" | "github";
      requiresPublication?: boolean;
      urlMayChange?: boolean;
    };
  }
> {
  const user = auth?.currentUser;
  if (!user || !experimentID)
    throw new BindingRequestError(
      "Sign in and open an experiment before verifying its destinations.",
      "AUTH_REQUIRED",
    );
  const uid = user.uid,
    token = await user.getIdToken();
  const route =
    action === "context"
      ? `deployment-context/${encodeURIComponent(experimentID)}`
      : `deployment-bindings/${encodeURIComponent(experimentID)}/${action}`;
  const response = await fetch(`${getApiBaseUrl()}/api/${route}`, {
    method: action === "context" ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(action !== "context" && { body: JSON.stringify(body) }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new BindingRequestError(
      "The backend returned an unreadable destination response. Update the backend and retry.",
      "BACKEND_UNAVAILABLE",
    );
  }
  if (!response.ok)
    throw new BindingRequestError(
      result.message ||
        result.error ||
        "Could not verify publication destinations.",
      result.code || "BACKEND_UNAVAILABLE",
    );
  if (
    auth?.currentUser?.uid !== uid ||
    !result.success ||
    result.experimentID !== experimentID ||
    result.verifiedOwnerUid !== uid ||
    !result.projectId ||
    !result.storage ||
    !result.github
  )
    throw new BindingRequestError(
      "The returned experiment, account or backend identity could not be verified.",
      "CLOUD_BINDING_MISMATCH",
    );
  if (action === "repair/inspect") result.repairPreview = result.preview;
  return result;
}
export const needsDestinationReview = (context: DeploymentContext) =>
  Boolean(context.pendingRepair) ||
  context.storage.state === "needs_confirmation" ||
  context.github.state === "needs_selection";
export function publicationStorage(
  context: DeploymentContext,
  selected?: string,
): string | undefined {
  if (context.pendingRepair)
    throw new BindingRequestError(
      "Resume the pending destination repair before publishing.",
      "REPAIR_IN_PROGRESS",
    );
  if (needsDestinationReview(context))
    throw new BindingRequestError(
      "Verify the original destinations from Publication destinations before publishing.",
      "BINDING_REVIEW_REQUIRED",
    );
  const linked = context.storage.provider;
  if (
    context.exists &&
    context.storage.provider &&
    selected &&
    linked !== selected
  )
    throw new BindingRequestError(
      "Publishing must use the linked data provider. Reconnect its account in Settings.",
      "STORAGE_CHANGE_REQUIRES_MIGRATION",
    );
  return context.exists && linked ? linked : selected;
}
