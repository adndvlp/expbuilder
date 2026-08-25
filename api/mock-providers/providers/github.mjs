import { bearerToken, parseForm, parseJson, readBody, send, sendJson } from "../http-utils.mjs";
import { nextId, store } from "../store.mjs";

const USERNAME = "mock-researcher";

export async function handleGithub(req, res, url, body) {
  const { pathname } = url;

  if (pathname === "/login/oauth/access_token" && req.method === "POST") {
    const form = parseForm(body);
    const code = form.get("code");
    if (!code) {
      send(res, 400, { "Content-Type": "application/json" }, JSON.stringify({ error: "bad_verification_code" }));
      return;
    }
    const token = `gho-${code}-${nextId("tok")}`;
    store.github.users.set(token, { login: USERNAME, id: 12345 });
    send(res, 200, { "Content-Type": "application/x-www-form-urlencoded" }, `access_token=${token}&scope=public_repo&token_type=bearer`);
    return;
  }

  if (pathname === "/user" && req.method === "GET") {
    const token = bearerToken(req);
    const user = store.github.users.get(token);
    if (!user) {
      sendJson(res, 401, { message: "Bad credentials" });
      return;
    }
    sendJson(res, 200, {
      login: user.login,
      id: user.id,
      name: "Mock Researcher",
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
      html_url: `https://github.com/${user.login}`,
    });
    return;
  }

  if (pathname === "/user/repos" && req.method === "POST") {
    const token = bearerToken(req);
    const user = store.github.users.get(token);
    if (!user) {
      sendJson(res, 401, { message: "Bad credentials" });
      return;
    }
    const data = parseJson(body) ?? {};
    const name = data.name ?? `repo-${nextId("n")}`;
    const repo = {
      id: nextId("repo"),
      name,
      full_name: `${user.login}/${name}`,
      owner: { login: user.login, id: user.id },
      private: Boolean(data.private),
      html_url: `https://github.com/${user.login}/${name}`,
      clone_url: `https://github.com/${user.login}/${name}.git`,
      default_branch: "main",
      pages: false,
    };
    store.github.repos.set(`${user.login}/${name}`, repo);
    sendJson(res, 201, repo);
    return;
  }

  const repoMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (repoMatch) {
    const [, owner, repoName, rest] = repoMatch;
    const key = `${owner}/${repoName}`;
    const repo = store.github.repos.get(key);

    if (!rest) {
      if (req.method === "GET") {
        if (!repo) {
          sendJson(res, 404, { message: "Not Found" });
          return;
        }
        sendJson(res, 200, repo);
        return;
      }
      if (req.method === "DELETE") {
        if (!repo) {
          sendJson(res, 404, { message: "Not Found" });
          return;
        }
        store.github.repos.delete(key);
        send(res, 204, {}, "");
        return;
      }
    }

    if (rest === "pages" && req.method === "POST") {
      if (!repo) {
        sendJson(res, 404, { message: "Not Found" });
        return;
      }
      const pages = {
        status: "built",
        html_url: `https://${owner}.github.io/${repoName}/`,
      };
      store.github.pages.set(key, pages);
      sendJson(res, 201, pages);
      return;
    }

    if (rest === "pages" && req.method === "GET") {
      const pages = store.github.pages.get(key);
      if (!pages) {
        sendJson(res, 404, { message: "Not Found" });
        return;
      }
      sendJson(res, 200, pages);
      return;
    }

    const contentsMatch = rest?.match(/^contents\/(.+)$/);
    if (contentsMatch) {
      const filePath = contentsMatch[1];
      const contentKey = `${key}/${filePath}`;
      if (req.method === "PUT") {
        const data = parseJson(body) ?? {};
        const file = {
          name: filePath.split("/").pop(),
          path: filePath,
          content: data.content ?? "",
          message: data.message ?? "",
          sha: nextId("sha"),
        };
        store.github.contents.set(contentKey, file);
        sendJson(res, 201, { content: file });
        return;
      }
      if (req.method === "GET") {
        const file = store.github.contents.get(contentKey);
        if (!file) {
          sendJson(res, 404, { message: "Not Found" });
          return;
        }
        sendJson(res, 200, file);
        return;
      }
    }

    const branchMatch = rest?.match(/^branches\/(.+)$/);
    if (branchMatch) {
      if (req.method === "GET") {
        if (!repo) {
          sendJson(res, 404, { message: "Not Found" });
          return;
        }
        sendJson(res, 200, { name: branchMatch[1] });
        return;
      }
    }
  }

  sendJson(res, 404, { message: "Not Found" });
}
