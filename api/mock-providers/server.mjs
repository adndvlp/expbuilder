import http from "http";
import { readBody } from "./http-utils.mjs";
import { handleGithub } from "./providers/github.mjs";
import { handleDropbox } from "./providers/dropbox.mjs";
import { handleGoogleDrive } from "./providers/google-drive.mjs";
import { handleOsf } from "./providers/osf.mjs";
import { resetStore } from "./store.mjs";

const BASE_PORT = Number(process.env.MOCK_PROVIDERS_BASE_PORT ?? 4010);

const PROVIDERS = [
  { name: "github", port: BASE_PORT, handler: handleGithub },
  { name: "dropbox", port: BASE_PORT + 1, handler: handleDropbox },
  { name: "google-drive", port: BASE_PORT + 2, handler: handleGoogleDrive },
  { name: "osf", port: BASE_PORT + 3, handler: handleOsf },
];

function onRequest(handler) {
  return (req, res) => {
    void (async () => {
      try {
        const body = await readBody(req);
        const url = new URL(req.url, "http://localhost");
        await handler(req, res, url, body, req.headers["content-type"]);
      } catch (error) {
        console.error(`[mock-provider] ${error.stack}`);
        res.writeHead(500);
        res.end("internal error");
      }
    })();
  };
}

export function startMockProviders() {
  const servers = [];
  for (const provider of PROVIDERS) {
    const server = http.createServer(onRequest(provider.handler));
    server.listen(provider.port, "127.0.0.1");
    servers.push(server);
    console.log(`[mock-provider] ${provider.name} listening on http://127.0.0.1:${provider.port}`);
  }
  return servers;
}

export function mockProviderUrls(basePort = BASE_PORT) {
  const origin = (port) => `http://127.0.0.1:${port}`;
  return {
    GITHUB_API_BASE: origin(basePort),
    GITHUB_OAUTH_TOKEN_URL: origin(basePort),
    DROPBOX_API_BASE: origin(basePort + 1),
    DROPBOX_CONTENT_BASE: origin(basePort + 1),
    DROPBOX_TOKEN_URL: origin(basePort + 1),
    GOOGLE_DRIVE_API_BASE: origin(basePort + 2),
    GOOGLE_OAUTH_TOKEN_URL: origin(basePort + 2),
    OSF_API_BASE: origin(basePort + 3),
    OSF_TOKEN_URL: origin(basePort + 3),
    OSF_AUTHORIZE_URL: origin(basePort + 3),
  };
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  resetStore();
  startMockProviders();
}
