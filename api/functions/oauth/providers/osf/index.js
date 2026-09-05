import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
export default {
  id: "osf",
  tokensFieldName: "osfTokens",
  config: {
    clientId: process.env.OSF_CLIENT_ID,
    clientSecret: process.env.OSF_CLIENT_SECRET,
    tokenUrl: `${endpoints.osf.tokenUrl}`,
  },
};
