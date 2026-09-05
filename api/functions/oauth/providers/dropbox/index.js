import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
export default {
  id: "dropbox",
  tokensFieldName: "dropboxTokens",
  config: {
    clientId: process.env.DROPBOX_CLIENT_ID,
    clientSecret: process.env.DROPBOX_CLIENT_SECRET,
    tokenUrl: `${endpoints.dropbox.tokenUrl}`,
  },
};
