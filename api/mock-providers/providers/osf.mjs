import { bearerToken, parseForm, parseJson, parseMultipart, readBody, send, sendJson } from "../http-utils.mjs";
import { nextId, store } from "../store.mjs";

function nodeJson(node, withRelationships = true) {
  const base = `${node.kind === "users" ? "/v2/users/me" : `/v2/nodes/${node.id}`}`;
  const data = {
    id: node.id,
    type: node.kind,
    attributes: node.attributes,
  };
  if (withRelationships) {
    data.relationships = {
      files: { links: { related: { href: `${base}/files/` } } },
      children: { links: { related: { href: `${base}/children/` } } },
    };
  }
  return data;
}

function listJson(items) {
  return {
    data: items.map((item) => item?.data ?? item),
    links: { first: null, last: null, next: null, prev: null, meta: { total: items.length, per_page: 10 } },
  };
}

function fileJson(nodeId, file) {
  return {
    data: {
      id: file.id,
      type: "files",
      attributes: {
        name: file.name,
        kind: "file",
        path: `/${file.name}`,
        size: file.content?.length ?? 0,
        provider: "osfstorage",
        date_created: file.createdAt,
        date_modified: file.createdAt,
        current_version: 1,
      },
      links: {
        download: `/v2/files/${file.id}/`,
        upload: `/v2/nodes/${nodeId}/files/osfstorage/`,
        info: `/v2/files/${file.id}/`,
        delete: `/v2/files/${file.id}/`,
      },
    },
  };
}

function ensureUser(token) {
  return store.osf.tokens.has(token);
}

export async function handleOsf(req, res, url, body, contentType) {
  const { pathname } = url;

  if (pathname === "/oauth2/token" && req.method === "POST") {
    const form = parseForm(body);
    const code = form.get("code");
    if (!code) {
      sendJson(res, 400, { error: "invalid_grant", error_description: "code is missing" });
      return;
    }
    const token = `osf-${code}-${nextId("tok")}`;
    store.osf.tokens.set(token, {});
    sendJson(res, 200, {
      access_token: token,
      token_type: "bearer",
      refresh_token: nextId("rt"),
      expires_in: 3600,
      scope: "osf.full_read osf.full_write",
    });
    return;
  }

  const token = bearerToken(req);
  if (!token || !ensureUser(token)) {
    sendJson(res, 401, { errors: [{ detail: "Authentication credentials were not provided." }] });
    return;
  }

  if (pathname === "/v2/users/me/" && req.method === "GET") {
    const userNode = { id: "me-user", kind: "users", attributes: { full_name: "Mock Researcher", given_name: "Mock", family_name: "Researcher", current_user_permissions: ["read", "write", "admin"] } };
    sendJson(res, 200, { data: nodeJson(userNode) });
    return;
  }

  if (pathname === "/v2/users/me/nodes/" && req.method === "GET") {
    const filterTitle = url.searchParams.get("filter[title]") ?? "";
    const nodes = [...store.osf.nodes.values()].filter(
      (node) => !node.parentId && (!filterTitle || node.attributes.title.includes(filterTitle)),
    );
    sendJson(res, 200, listJson(nodes.map((n) => nodeJson(n))));
    return;
  }

  if (pathname === "/v2/nodes/" && req.method === "POST") {
    const data = parseJson(body) ?? {};
    const attributes = data?.data?.attributes ?? {};
    const node = {
      id: nextId("node"),
      kind: "nodes",
      parentId: null,
      attributes: {
        title: attributes.title ?? "Untitled",
        description: attributes.description ?? "",
        category: attributes.category ?? "project",
        current_user_permissions: ["read", "write", "admin"],
      },
    };
    store.osf.nodes.set(node.id, node);
    sendJson(res, 201, { data: nodeJson(node) });
    return;
  }

  const nodeMatch = pathname.match(/^\/v2\/nodes\/([^/]+)\/?$/);
  if (nodeMatch && req.method === "GET") {
    const node = store.osf.nodes.get(nodeMatch[1]);
    if (!node) {
      sendJson(res, 404, { errors: [{ detail: "Not found." }] });
      return;
    }
    sendJson(res, 200, { data: nodeJson(node) });
    return;
  }

  const childrenMatch = pathname.match(/^\/v2\/nodes\/([^/]+)\/children\/?$/);
  if (childrenMatch && req.method === "POST") {
    const parentId = childrenMatch[1];
    const parent = store.osf.nodes.get(parentId);
    if (!parent) {
      sendJson(res, 404, { errors: [{ detail: "Not found." }] });
      return;
    }
    const data = parseJson(body) ?? {};
    const attributes = data?.data?.attributes ?? {};
    const child = {
      id: nextId("node"),
      kind: "nodes",
      parentId,
      attributes: {
        title: attributes.title ?? "Component",
        category: "project",
        current_user_permissions: ["read", "write", "admin"],
      },
    };
    store.osf.nodes.set(child.id, child);
    sendJson(res, 201, { data: nodeJson(child) });
    return;
  }

  if (childrenMatch && req.method === "GET") {
    const parentId = childrenMatch[1];
    const children = [...store.osf.nodes.values()].filter((n) => n.parentId === parentId);
    sendJson(res, 200, listJson(children.map((n) => nodeJson(n))));
    return;
  }

  const filesMatch = pathname.match(/^\/v2\/nodes\/([^/]+)\/files\/?$/);
  if (filesMatch && req.method === "GET") {
    const nodeId = filesMatch[1];
    const node = store.osf.nodes.get(nodeId);
    if (!node) {
      sendJson(res, 404, { errors: [{ detail: "Not found." }] });
      return;
    }
    sendJson(res, 200, listJson([
      {
        id: "osfstorage-provider",
        type: "files",
        attributes: { name: "osfstorage", kind: "folder", provider: "osfstorage" },
        relationships: {
          files: { links: { related: { href: `/v2/nodes/${nodeId}/files/osfstorage/` } } },
        },
      },
    ]));
    return;
  }

  const storageMatch = pathname.match(/^\/v2\/nodes\/([^/]+)\/files\/osfstorage\/?$/);
  if (storageMatch && req.method === "POST") {
    const nodeId = storageMatch[1];
    const node = store.osf.nodes.get(nodeId);
    if (!node) {
      sendJson(res, 404, { errors: [{ detail: "Not found." }] });
      return;
    }
    const parts = parseMultipart(body, contentType ?? "");
    const filePart = parts.find((p) => p.name === "file" || p.filename);
    const name = url.searchParams.get("name") ?? filePart?.filename ?? "upload.csv";
    const file = {
      id: nextId("file"),
      name,
      content: filePart ? Buffer.from(filePart.content) : Buffer.alloc(0),
      createdAt: new Date().toISOString(),
    };
    store.osf.files.set(file.id, file);
    sendJson(res, 201, fileJson(nodeId, file));
    return;
  }

  if (storageMatch && req.method === "GET") {
    const nodeId = storageMatch[1];
    const files = [...store.osf.files.values()];
    sendJson(res, 200, listJson(files.map((f) => fileJson(nodeId, f))));
    return;
  }

  const fileMatch = pathname.match(/^\/v2\/files\/([^/]+)\/?$/);
  if (fileMatch && req.method === "GET") {
    const file = store.osf.files.get(fileMatch[1]);
    if (!file) {
      sendJson(res, 404, { errors: [{ detail: "Not found." }] });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/csv" });
    res.end(file.content);
    return;
  }

  if (fileMatch && req.method === "DELETE") {
    store.osf.files.delete(fileMatch[1]);
    res.writeHead(204);
    res.end();
    return;
  }

  sendJson(res, 404, { errors: [{ detail: "Not found." }] });
}
