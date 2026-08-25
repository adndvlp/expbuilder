import fetch from "../../../../utils/fetch-with-timeout.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../../../utils/provider-endpoints.js";

export async function deleteRepositoryGithub(accessToken, owner, repoName) {
  try {
    const deleteResponse = await fetch(
      `${endpoints.github.apiBase}/repos/${owner}/${repoName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      const errorResult = await deleteResponse.json();
      return {
        success: false,
        errorText: errorResult.message || "Error deleting repository",
        errorCode: deleteResponse.status,
      };
    }

    return {
      success: true,
      message: "Repository deleted successfully",
    };
  } catch (error) {
    return {
      success: false,
      errorText: error.message,
    };
  }
}
