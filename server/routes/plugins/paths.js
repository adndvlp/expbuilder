import path from "path";
import { __dirname } from "../../utils/paths.js";
import { userDataRoot } from "../../utils/db.js";

export const metadataPath = path.join(__dirname, "metadata");
export const componentsMetadataPath = path.join(__dirname, "components-metadata");
export const pluginsDir = path.join(userDataRoot, "plugins");
