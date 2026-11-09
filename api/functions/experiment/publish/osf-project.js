import { db } from "../../app.js";
import { getValidToken } from "../../oauth/index.js";
import fetch from "../../utils/fetch-with-timeout.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../utils/provider-endpoints.js";

export async function ensureOsfProject(uid, options = {}) {
  const userRef = db.collection("users").doc(uid);
  const user = await userRef.get();
  if (!user.exists)
    throw new Error("Connect your OSF account before preparing an experiment");
  if (user.data().osfProjectId) return user.data().osfProjectId;
  const token = options.token
    ? { success: true, access_token: options.token }
    : await getValidToken("osf", uid);
  if (!token.success)
    throw new Error("Could not obtain an OSF token to prepare the project");
  await options.check?.();
  const response = await fetch(`${endpoints.osf.apiBase}/v2/nodes/?region=us`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.access_token}`,
    },
    body: JSON.stringify({
      data: {
        type: "nodes",
        attributes: {
          title: "ExpBuilder",
          category: "project",
          description: "Experiment Builder data storage",
          public: false,
        },
      },
    }),
  });
  if (!response.ok) throw new Error("Could not prepare the OSF project");
  const projectId = (await response.json()).data?.id;
  if (!projectId) throw new Error("OSF returned no project identifier");
  await userRef.update({ osfProjectId: projectId });
  return projectId;
}
