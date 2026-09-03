import { send, sendJson } from "../http-utils.mjs";
import { store } from "../store.mjs";

const CONTENT_TYPES = {
  css: "text/css; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  png: "image/png",
  svg: "image/svg+xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  wasm: "application/wasm",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
  xml: "application/xml; charset=utf-8",
};

function contentType(filePath) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

export async function handleGithubPages(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { message: "Method Not Allowed" });
    return;
  }

  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (!match) {
    sendJson(res, 404, { message: "Not Found" });
    return;
  }

  const [, owner, repoName, requestedPath = ""] = match;
  const repoKey = `${owner}/${repoName}`;
  if (!store.github.pages.has(repoKey)) {
    sendJson(res, 404, { message: "Not Found" });
    return;
  }

  const filePath = requestedPath && !requestedPath.endsWith("/")
    ? requestedPath
    : `${requestedPath}index.html`;
  const file = store.github.contents.get(`${repoKey}/${filePath}`);
  if (!file) {
    sendJson(res, 404, { message: "Not Found" });
    return;
  }

  const content = Buffer.from(file.content, "base64");
  send(res, 200, {
    "Content-Length": String(content.byteLength),
    "Content-Type": contentType(filePath),
  }, req.method === "HEAD" ? "" : content);
}
