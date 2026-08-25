import { bearerToken, parseForm, parseJson, parseMultipart, readBody, send, sendJson } from "../http-utils.mjs";
import { nextId, store } from "../store.mjs";

export async function handleGoogleDrive(req, res, url, body, contentType) {
  const { pathname } = url;

  if (pathname === "/token" && req.method === "POST") {
    const form = parseForm(body);
    const code = form.get("code");
    if (!code) {
      sendJson(res, 400, { error: "invalid_grant", error_description: "Code was already redeemed." });
      return;
    }
    const token = `ya29.${code}-${nextId("tok")}`;
    store.drive.tokens.set(token, {});
    sendJson(res, 200, {
      access_token: token,
      token_type: "Bearer",
      refresh_token: `1//${nextId("rt")}`,
      expires_in: 3599,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
    });
    return;
  }

  if (pathname === "/oauth2/v2/userinfo" && req.method === "GET") {
    sendJson(res, 200, {
      email: "mock-researcher@gmail.com",
      id: "123456",
      verified_email: true,
    });
    return;
  }

  const token = bearerToken(req);
  if (!token || !store.drive.tokens.has(token)) {
    sendJson(res, 401, { error: { code: 401, message: "Invalid Credentials" } });
    return;
  }

  if (pathname === "/drive/v3/files" && req.method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    const files = [...store.drive.files.values()].filter((file) => {
      if (!q) return true;
      if (q.includes("name=")) {
        const wanted = q.match(/name\s*=\s*'([^']+)'/)?.[1];
        if (wanted) return file.name.includes(wanted);
      }
      return true;
    });
    sendJson(res, 200, { files, incompleteSearch: false });
    return;
  }

  if (pathname === "/drive/v3/files" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const file = {
      id: nextId("file"),
      name: data.name ?? "untitled",
      mimeType: data.mimeType ?? "application/octet-stream",
      webViewLink: "https://drive.google.com/file/d/mock/view",
    };
    store.drive.files.set(file.id, { ...file, content: Buffer.alloc(0) });
    sendJson(res, 200, file);
    return;
  }

  if (pathname === "/upload/drive/v3/files" && req.method === "POST") {
    const parts = parseMultipart(body, contentType ?? "");
    const metadataPart = parts.find((p) =>
      p.contentType.includes("application/json"),
    );
    const mediaPart = parts.find(
      (p) => !p.contentType.includes("application/json"),
    );
    const metadata = metadataPart ? parseJson(metadataPart.content) : null;
    const name = metadata?.name ?? mediaPart?.filename ?? "uploaded.csv";
    const file = {
      id: nextId("file"),
      name,
      mimeType: metadata?.mimeType ?? "application/octet-stream",
      webViewLink: "https://drive.google.com/file/d/mock/view",
    };
    store.drive.files.set(file.id, {
      ...file,
      content: mediaPart ? Buffer.from(mediaPart.content) : Buffer.alloc(0),
    });
    sendJson(res, 200, file);
    return;
  }

  const mediaMatch = pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)\?uploadType=media$/);
  if (mediaMatch && req.method === "PATCH") {
    const fileId = mediaMatch[1];
    const existing = store.drive.files.get(fileId);
    if (!existing) {
      sendJson(res, 404, { error: { code: 404, message: "File not found" } });
      return;
    }
    existing.content = body;
    sendJson(res, 200, existing);
    return;
  }

  const fileMatch = pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (fileMatch) {
    const fileId = fileMatch[1];
    const existing = store.drive.files.get(fileId);
    if (req.method === "GET" && url.searchParams.get("alt") === "media") {
      if (!existing) {
        sendJson(res, 404, { error: { code: 404, message: "File not found" } });
        return;
      }
      res.writeHead(200, { "Content-Type": existing.mimeType ?? "text/csv" });
      res.end(existing.content);
      return;
    }
    if (req.method === "GET") {
      if (!existing) {
        sendJson(res, 404, { error: { code: 404, message: "File not found" } });
        return;
      }
      sendJson(res, 200, existing);
      return;
    }
    if (req.method === "DELETE") {
      store.drive.files.delete(fileId);
      res.writeHead(204);
      res.end();
      return;
    }
  }

  sendJson(res, 404, { error: { code: 404, message: "Not Found" } });
}
