import http from "http";
import { readBody } from "./http-utils.mjs";
import { handleGithub } from "./providers/github.mjs";
import { handleGithubPages } from "./providers/github-pages.mjs";
import { handleDropbox } from "./providers/dropbox.mjs";
import { handleGoogleDrive } from "./providers/google-drive.mjs";
import { handleOsf } from "./providers/osf.mjs";
import { resetStore } from "./store.mjs";

const BASE_PORT = Number(process.env.MOCK_PROVIDERS_BASE_PORT ?? 4010);
const origin = (port) => `http://127.0.0.1:${port}`;
const GITHUB_PAGES_ORIGIN = origin(BASE_PORT + 4);

const PROVIDERS = [
  {
    name: "github",
    port: BASE_PORT,
    handler: (req, res, url, body) => handleGithub(req, res, url, body, GITHUB_PAGES_ORIGIN),
  },
  { name: "dropbox", port: BASE_PORT + 1, handler: handleDropbox },
  { name: "google-drive", port: BASE_PORT + 2, handler: handleGoogleDrive },
  { name: "osf", port: BASE_PORT + 3, handler: handleOsf },
  { name: "github-pages", port: BASE_PORT + 4, handler: handleGithubPages },
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
  return {
    GITHUB_API_BASE: origin(basePort),
    GITHUB_OAUTH_TOKEN_URL: `${origin(basePort)}/login/oauth/access_token`,
    DROPBOX_API_BASE: origin(basePort + 1),
    DROPBOX_CONTENT_BASE: origin(basePort + 1),
    DROPBOX_TOKEN_URL: `${origin(basePort + 1)}/oauth2/token`,
    GOOGLE_DRIVE_API_BASE: origin(basePort + 2),
    GOOGLE_OAUTH_TOKEN_URL: `${origin(basePort + 2)}/token`,
    OSF_API_BASE: origin(basePort + 3),
    OSF_TOKEN_URL: `${origin(basePort + 3)}/oauth2/token`,
    OSF_AUTHORIZE_URL: origin(basePort + 3),
    GITHUB_PAGES_BASE: origin(basePort + 4),
  };
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  resetStore();
  startMockProviders();
}
