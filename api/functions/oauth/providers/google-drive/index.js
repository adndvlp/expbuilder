import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
export default {
  id: "googledrive",
  tokensFieldName: "googleDriveTokens",
  config: {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    tokenUrl: `${endpoints.googleDrive.tokenUrl}`,
  },
};
