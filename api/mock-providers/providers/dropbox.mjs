import { bearerToken, parseForm, parseJson, readBody, send, sendJson } from "../http-utils.mjs";
import { nextId, store } from "../store.mjs";

function entryMeta(pathValue, kind, id, extra = {}) {
  const name = pathValue === "" || pathValue === "/" ? "" : pathValue.split("/").pop();
  return {
    name,
    path_lower: pathValue.toLowerCase(),
    path_display: pathValue,
    id,
    ".tag": kind,
    ...extra,
  };
}

function normalizePath(pathValue) {
  if (!pathValue || pathValue === "/") return "";
  return pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
}

export async function handleDropbox(req, res, url, body) {
  const { pathname } = url;

  if (pathname === "/oauth2/token" && req.method === "POST") {
    const form = parseForm(body);
    const code = form.get("code");
    if (!code) {
      sendJson(res, 400, { error: "invalid_grant", error_description: "code not found" });
      return;
    }
    const token = `sl.${code}-${nextId("tok")}`;
    store.dropbox.tokens.set(token, {});
    sendJson(res, 200, {
      access_token: token,
      token_type: "bearer",
      refresh_token: `r.${nextId("rt")}`,
      expires_in: 14400,
      account_id: "dbid:mock-account",
      scope: "account_info.read files.content.read files.content.write",
    });
    return;
  }

  const token = bearerToken(req);
  if (!token || !store.dropbox.tokens.has(token)) {
    sendJson(res, 401, { error_summary: "invalid_access_token/", error: { ".tag": "invalid_access_token" } });
    return;
  }

  const apiArgHeader = req.headers["dropbox-api-arg"];
  const apiArg = apiArgHeader ? parseJson(Buffer.from(String(apiArgHeader), "utf8")) : null;

  if (pathname === "/2/files/create_folder_v2" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const pathValue = normalizePath(data.path);
    if (store.dropbox.entries.has(pathValue)) {
      sendJson(res, 409, { error_summary: "path/conflict/folder/", error: { ".tag": "path" } });
      return;
    }
    const id = `id:${nextId("folder")}`;
    const metadata = entryMeta(pathValue, "folder", id);
    store.dropbox.entries.set(pathValue, metadata);
    sendJson(res, 200, { metadata });
    return;
  }

  if (pathname === "/2/files/get_metadata" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const pathValue = normalizePath(data.path);
    const metadata = store.dropbox.entries.get(pathValue);
    if (!metadata) {
      sendJson(res, 409, { error_summary: "path/not_found/", error: { ".tag": "path" } });
      return;
    }
    sendJson(res, 200, { metadata });
    return;
  }

  if (pathname === "/2/files/upload" && req.method === "POST") {
    const pathValue = normalizePath(apiArg?.path ?? "/upload.csv");
    const id = `id:${nextId("file")}`;
    const metadata = entryMeta(pathValue, "file", id, {
      size: body.length,
      server_modified: new Date().toISOString(),
    });
    store.dropbox.entries.set(pathValue, metadata);
    store.dropbox.files.set(pathValue, body);
    sendJson(res, 200, metadata);
    return;
  }

  if (pathname === "/2/files/download" && req.method === "POST") {
    const pathValue = normalizePath(apiArg?.path ?? "");
    const content = store.dropbox.files.get(pathValue);
    if (content === undefined) {
      sendJson(res, 409, { error_summary: "path/not_found/", error: { ".tag": "path" } });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Dropbox-Api-Result": JSON.stringify({ name: pathValue.split("/").pop() }),
    });
    res.end(content);
    return;
  }

  if (pathname === "/2/files/delete_v2" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const pathValue = normalizePath(data.path);
    const metadata = store.dropbox.entries.get(pathValue);
    store.dropbox.entries.delete(pathValue);
    store.dropbox.files.delete(pathValue);
    sendJson(res, 200, { metadata: metadata ?? entryMeta(pathValue, "file", `id:${nextId("gone")}`) });
    return;
  }

  if (pathname === "/2/files/list_folder" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const prefix = normalizePath(data.path);
    const entries = [...store.dropbox.entries.values()].filter((entry) => {
      if (prefix === "") return true;
      return entry.path_lower !== prefix && entry.path_lower.startsWith(`${prefix}/`);
    });
    sendJson(res, 200, { entries, cursor: "cursor-1", has_more: false });
    return;
  }

  if (pathname === "/2/files/list_folder/continue" && req.method === "POST") {
    sendJson(res, 200, { entries: [], cursor: "cursor-1", has_more: false });
    return;
  }

  if (pathname === "/2/sharing/create_shared_link_with_settings" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const pathValue = normalizePath(data.path);
    const link = `https://www.dropbox.com/s/${nextId("sh")}/file.csv?dl=0`;
    store.dropbox.sharedLinks.set(pathValue, link);
    sendJson(res, 200, { url: link });
    return;
  }

  if (pathname === "/2/sharing/list_shared_links" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const pathValue = normalizePath(data.path);
    const url = store.dropbox.sharedLinks.get(pathValue);
    sendJson(res, 200, { links: url ? [{ url }] : [], has_more: false });
    return;
  }

  sendJson(res, 404, { error_summary: "route/not_found/" });
}
