import { getValidToken } from "../../oauth/index.js";
import { assertExperimentOwner } from "../access.js";
import { pinSessionStorage } from "./session-storage.js";
import { verifyStorageBinding } from "./storage.js";

export async function getExperimentStorageToken(
  provider,
  uid,
  data,
  experimentID,
  sessionId,
  options,
) {
  if (!data.storageBinding) return getValidToken(provider, uid);
  assertExperimentOwner(data, uid);
  const binding = await pinSessionStorage(
    data,
    experimentID || data.id,
    sessionId,
    options,
  );
  data.storageBinding = binding;
  const verified = await verifyStorageBinding(
    { ...data, id: experimentID || data.id },
    uid,
    provider,
  );
  // Projections belong to this request. Participant calls cannot rewrite the binding.
  Object.assign(data, verified.projection);
  return { success: true, access_token: verified.client.token };
}
