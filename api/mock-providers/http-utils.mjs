export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function parseJson(body) {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
}

export function parseForm(body) {
  return new URLSearchParams(body.toString("utf8"));
}

export function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

export function sendJson(res, status, data) {
  send(res, status, { "Content-Type": "application/json" }, JSON.stringify(data));
}

export function sendText(res, status, text) {
  send(res, status, { "Content-Type": "text/plain" }, text);
}

export function parseMultipart(body, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = match ? match[1] ?? match[2] : null;
  if (!boundary) return [];
  const parts = [];
  const raw = body.toString("latin1");
  const marker = `--${boundary}`;
  let cursor = raw.indexOf(marker);
  while (cursor !== -1) {
    const next = raw.indexOf(marker, cursor + marker.length);
    if (next === -1) break;
    const section = raw.slice(cursor + marker.length, next).replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = section.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headerBlock = section.slice(0, headerEnd);
      const content = Buffer.from(section.slice(headerEnd + 4), "latin1");
      const headers = {};
      for (const line of headerBlock.split("\r\n")) {
        const colon = line.indexOf(":");
        if (colon !== -1) {
          headers[line.slice(0, colon).trim().toLowerCase()] = line
            .slice(colon + 1)
            .trim();
        }
      }
      const disposition = headers["content-disposition"] ?? "";
      const nameMatch = disposition.match(/name="([^"]+)"/);
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      parts.push({
        name: nameMatch ? nameMatch[1] : null,
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: headers["content-type"] ?? "text/plain",
        content,
      });
    }
    cursor = next;
  }
  return parts;
}

export function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("access_token") ?? null;
}
