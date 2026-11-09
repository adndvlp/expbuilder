import { jest } from "@jest/globals";
import { makeReq, makeRes } from "../helpers/firestore-mock.js";
import { makeExperimentStore } from "../helpers/experiment-store.js";

const store = makeExperimentStore();
const oldFolder = jest.fn(),
  deleteFolder = jest.fn(),
  upload = jest.fn();
const participantUpload = jest.fn();
const githubToken = jest.fn(),
  storageToken = jest.fn();
const http = jest.fn();
let repositoryAvailable,
  driveAccount,
  githubAccount,
  folderAvailable,
  marker,
  repository,
  dropboxAccount,
  osfAccount,
  driveFolders,
  newRepository,
  newMarker,
  collision,
  loseCreationResponse,
  dropboxFolders,
  dropboxMarkers,
  osfNodes,
  failRepositoryDelete;
const projectId = "m04-project";
const reply = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const githubBinding = () => ({
  repositoryId: "123",
  accountId: "9",
  accountLogin: "alice",
  ownerLogin: "alice",
  repoName: "fixed-study",
  branch: "main",
  isPrivate: false,
});
const storageBinding = () => ({
  provider: "googledrive",
  accountId: "drive-alice",
  accountLabel: "researcher@example.invalid",
  folderId: "original-folder",
});
const original = () => ({
  id: "study",
  owner: "owner",
  title: "Original",
  storageProvider: "googledrive",
  storageBinding: storageBinding(),
  githubBinding: githubBinding(),
  driveFolderId: "original-folder",
  driveFolderPath: "/ExpBuilder/Original",
  active: false,
  sessions: 17,
  currentCondition: 4,
});

jest.unstable_mockModule("../../app.js", () => ({
  db: store.db,
  app: { options: { projectId } },
}));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (...args) => args.at(-1),
}));
jest.unstable_mockModule("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: async () => ({ uid: "owner" }) }),
}));
jest.unstable_mockModule("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "server-time", increment: (n) => n },
}));
jest.unstable_mockModule("firebase-admin/database", () => ({
  getDatabase: () => ({ ref: () => ({ remove: async () => {} }) }),
}));
jest.unstable_mockModule("../../utils/fetch-with-timeout.js", () => ({
  default: http,
}));
jest.unstable_mockModule("../../oauth/index.js", () => ({
  getValidToken: storageToken,
}));
jest.unstable_mockModule("../../oauth/providers/github/token.js", () => ({
  getGithubToken: githubToken,
  getGithubOwner: async () => "alice",
}));
jest.unstable_mockModule(
  "../../experiment/sessions/services/folder.js",
  () => ({ createFolder: oldFolder, deleteFolder }),
);
jest.unstable_mockModule(
  "../../experiment/sessions/logging/write-log.js",
  () => ({ default: jest.fn() }),
);
jest.unstable_mockModule(
  "../../experiment/participant-files/upload.js",
  () => ({ uploadFileToBucket: participantUpload }),
);
jest.unstable_mockModule("../../experiment/hosting/services.js", () => ({
  uploadFileGithub: upload,
  getRepositoryInfo: async () => ({ success: true, repo: repository }),
  createRepositoryGithub: jest.fn(),
  waitForGithubRepoReady: async () => ({ success: true }),
  deleteRepositoryGithub: jest.fn().mockResolvedValue({ success: true }),
  enableGithubPages: async () => ({
    success: true,
    pagesUrl: "https://alice.github.io/fixed-study/",
  }),
}));
const { publishExperiment } = await import("../../experiment/publish/index.js");
const publish = async (extra = {}) => {
  const res = makeRes();
  await publishExperiment(
    makeReq({
      method: "POST",
      headers: { authorization: "Bearer investigator" },
      body: {
        experimentID: "study",
        repoName: "renamed-study",
        htmlContent: "<html/>",
        storageProvider: "googledrive",
        ...extra,
      },
    }),
    res,
  );
  res.body = res.json.mock.calls.at(-1)?.[0];
  return res;
};
beforeEach(() => {
  store.reset();
  jest.clearAllMocks();
  store.seed("experiments/study", original());
  driveAccount = "drive-alice";
  githubAccount = "9";
  folderAvailable = true;
  dropboxAccount = "dbid:alice";
  osfAccount = "osf-alice";
  driveFolders = [];
  newRepository = null;
  newMarker = null;
  collision = false;
  loseCreationResponse = false;
  failRepositoryDelete = false;
  repositoryAvailable = true;
  dropboxFolders = new Map([
    [
      "/expbuilder",
      {
        ".tag": "folder",
        id: "id:root",
        path_lower: "/expbuilder",
        name: "ExpBuilder",
      },
    ],
  ]);
  dropboxMarkers = new Map();
  osfNodes = [];
  marker = {
    format: "expbuilder",
    schemaVersion: 1,
    backendProjectId: projectId,
    experimentID: "study",
  };
  repository = {
    id: 123,
    name: "fixed-study",
    full_name: "alice/fixed-study",
    owner: { id: 9, login: "alice" },
    default_branch: "main",
    permissions: { push: true, admin: true },
    html_url: "https://github.com/alice/fixed-study",
  };
  storageToken.mockResolvedValue({
    success: true,
    access_token: "storage-token",
  });
  githubToken.mockResolvedValue({
    success: true,
    access_token: "github-token",
  });
  oldFolder.mockResolvedValue({
    success: true,
    folderId: "replacement-folder",
  });
  upload.mockResolvedValue({ success: true, commit: "commit" });
  http.mockImplementation(async (url, init = {}) => {
    const parsed = new URL(url);
    if (init.method === "DELETE") {
      if (parsed.pathname === "/drive/v3/files/original-folder") {
        folderAvailable = false;
        return reply(204, {});
      }
      if (parsed.pathname === "/repos/alice/fixed-study")
        return failRepositoryDelete ? reply(503, {}) : reply(204, {});
    }
    if (parsed.pathname === "/drive/v3/files") {
      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        const folder = {
          ...body,
          id: "new-folder",
          capabilities: { canAddChildren: true },
          trashed: false,
        };
        driveFolders.push(folder);
        return reply(200, folder);
      }
      return reply(200, { files: driveFolders });
    }
    if (parsed.pathname === "/drive/v3/files/new-folder")
      return reply(200, driveFolders[0]);
    if (parsed.pathname === "/drive/v3/about")
      return reply(200, {
        user: {
          permissionId: driveAccount,
          emailAddress: "researcher@example.invalid",
        },
      });
    if (parsed.pathname === "/2/users/get_current_account")
      return reply(200, {
        account_id: dropboxAccount,
        email: "dropbox@example.invalid",
      });
    if (parsed.pathname === "/2/files/get_metadata") {
      const path = JSON.parse(init.body).path;
      if (path === "id:original" || path === "/ExpBuilder/Original")
        return folderAvailable
          ? reply(200, {
              ".tag": "folder",
              id: "id:original",
              path_lower: "/renamed-folder",
              name: "Renamed",
            })
          : reply(409, {
              error: { ".tag": "path", path: { ".tag": "not_found" } },
            });
      const folder =
        dropboxFolders.get(path.toLowerCase()) ||
        [...dropboxFolders.values()].find((folder) => folder.id === path);
      return folder
        ? reply(200, folder)
        : reply(409, {
            error: { ".tag": "path", path: { ".tag": "not_found" } },
          });
    }
    if (parsed.pathname === "/2/files/create_folder_v2") {
      const path = JSON.parse(init.body).path.toLowerCase();
      const folder = {
        ".tag": "folder",
        id: "id:new-folder",
        name: path.split("/").at(-1),
        path_lower: path,
      };
      dropboxFolders.set(path, folder);
      return reply(200, { metadata: folder });
    }
    if (parsed.pathname === "/2/files/download") {
      const path = JSON.parse(
        init.headers["Dropbox-API-Arg"],
      ).path.toLowerCase();
      return dropboxMarkers.has(path)
        ? reply(200, dropboxMarkers.get(path))
        : reply(409, {
            error: { ".tag": "path", path: { ".tag": "not_found" } },
          });
    }
    if (parsed.pathname === "/2/files/upload") {
      const path = JSON.parse(
        init.headers["Dropbox-API-Arg"],
      ).path.toLowerCase();
      if (dropboxMarkers.has(path))
        return reply(409, {
          error: { ".tag": "path", path: { ".tag": "conflict" } },
        });
      dropboxMarkers.set(path, JSON.parse(String(init.body)));
      return reply(200, { id: "marker-file" });
    }
    if (parsed.pathname === "/v2/users/me/")
      return reply(200, {
        data: { id: osfAccount, attributes: { full_name: "Researcher" } },
      });
    if (parsed.pathname === "/v2/nodes/osf-component/")
      return reply(folderAvailable ? 200 : 404, {
        data: {
          id: "osf-component",
          attributes: {
            title: "Original",
            current_user_permissions: ["read", "write", "admin"],
          },
        },
      });
    if (parsed.pathname === "/v2/nodes/osf-component/files/")
      return reply(200, {
        data: [
          {
            id: "osfstorage",
            attributes: { name: "osfstorage" },
            links: {
              upload:
                "https://files.osf.io/v1/resources/osf-component/providers/osfstorage/",
            },
          },
        ],
      });
    if (parsed.pathname === "/v2/nodes/osf-root/")
      return reply(200, {
        data: {
          id: "osf-root",
          attributes: { current_user_permissions: ["read", "write", "admin"] },
        },
      });
    if (parsed.pathname === "/v2/nodes/osf-root/children/") {
      if (init.method === "POST") {
        const data = JSON.parse(init.body).data;
        const node = {
          ...data,
          id: "osf-new",
          attributes: {
            ...data.attributes,
            current_user_permissions: ["read", "write", "admin"],
          },
        };
        osfNodes.push(node);
        return reply(201, { data: node });
      }
      return reply(200, { data: osfNodes, links: { next: null } });
    }
    if (parsed.pathname === "/v2/nodes/osf-new/")
      return reply(200, { data: osfNodes[0] });
    if (parsed.pathname === "/v2/nodes/osf-new/files/")
      return reply(200, {
        data: [
          {
            id: "osfstorage",
            attributes: { name: "osfstorage" },
            links: {
              upload:
                "https://files.osf.io/v1/resources/osf-new/providers/osfstorage/",
            },
          },
        ],
      });
    if (parsed.pathname === "/drive/v3/files/original-folder")
      return reply(
        folderAvailable ? 200 : 404,
        folderAvailable
          ? {
              id: "original-folder",
              name: "Original",
              mimeType: "application/vnd.google-apps.folder",
              trashed: false,
              capabilities: { canAddChildren: true, canDelete: true },
            }
          : {},
      );
    if (parsed.pathname === "/user")
      return reply(200, { id: Number(githubAccount), login: "alice" });
    if (parsed.pathname === "/repos/alice/fixed-study")
      return reply(repositoryAvailable ? 200 : 404, repository);
    if (parsed.pathname === "/user/repos") {
      const body = JSON.parse(init.body);
      newRepository = {
        id: 999,
        name: body.name,
        full_name: `alice/${body.name}`,
        owner: { id: 9, login: "alice" },
        default_branch: "main",
        permissions: { push: true, admin: true },
        html_url: `https://github.com/alice/${body.name}`,
      };
      if (loseCreationResponse)
        throw new Error("Connection interrupted after repository creation");
      return reply(201, newRepository);
    }
    if (/^\/repos\/alice\/[^/]+$/.test(parsed.pathname)) {
      if (newRepository && parsed.pathname.endsWith("/" + newRepository.name))
        return reply(200, newRepository);
      if (collision && !parsed.pathname.endsWith("-2"))
        return reply(200, {
          ...repository,
          id: 777,
          name: parsed.pathname.split("/").at(-1),
        });
      return reply(404, {});
    }
    if (
      newRepository &&
      parsed.pathname === `/repos/alice/${newRepository.name}/branches/main`
    )
      return reply(200, { name: "main", commit: { sha: "new-head" } });
    if (parsed.pathname === "/repos/alice/fixed-study/branches/main")
      return reply(200, { name: "main", commit: { sha: "head" } });
    if (parsed.pathname.endsWith("/contents/expbuilder-manifest.json")) {
      if (
        newRepository &&
        parsed.pathname.startsWith(`/repos/alice/${newRepository.name}/`)
      ) {
        if (init.method === "PUT") {
          if (newMarker) return reply(422, {});
          newMarker = JSON.parse(
            Buffer.from(JSON.parse(init.body).content, "base64").toString(
              "utf8",
            ),
          );
          return reply(201, { content: { sha: "new-marker" } });
        }
        return newMarker
          ? reply(200, {
              content: Buffer.from(JSON.stringify(newMarker)).toString(
                "base64",
              ),
              encoding: "base64",
              sha: "new-marker",
            })
          : reply(404, {});
      }
      if (init.method === "PUT") {
        if (marker) return reply(422, {});
        marker = JSON.parse(
          Buffer.from(JSON.parse(init.body).content, "base64").toString("utf8"),
        );
        return reply(201, { content: { sha: "marker" } });
      }
      return marker
        ? reply(200, {
            content: Buffer.from(JSON.stringify(marker)).toString("base64"),
            encoding: "base64",
            sha: "marker",
          })
        : reply(404, {});
    }
    if (parsed.pathname.endsWith("/pages"))
      return reply(200, {
        source: { branch: "main", path: "/" },
        html_url: "https://alice.github.io/fixed-study/",
      });
    throw new Error(
      `Unexpected provider request: ${init.method || "GET"} ${parsed.pathname}`,
    );
  });
});
async function bindingApi(name, body) {
  const endpoint = (await import("../../experiment/bindings/api.js"))[name],
    res = makeRes();
  await endpoint(
    makeReq({
      method: "POST",
      headers: { authorization: "Bearer investigator" },
      body: { experimentID: "study", ...body },
    }),
    res,
  );
  res.body = res.json.mock.calls.at(-1)?.[0];
  return res;
}
const legacy = () => {
  const data = original();
  delete data.storageBinding;
  delete data.githubBinding;
  store.seed("experiments/study", data);
};
const inspectLegacy = () =>
  bindingApi("configureExperimentBindings", {
    action: "inspect",
    selection: { repository: "https://github.com/alice/fixed-study" },
  });
test("deployment context is authoritative and read-only", async () => {
  const data = original();
  data.githubBinding.access_token = "DO_NOT_EXPOSE";
  data.storageBinding.refresh_token = "DO_NOT_EXPOSE";
  store.seed("experiments/study", data);
  const res = await bindingApi("getExperimentDeploymentContext", {});
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({
    exists: true,
    projectId,
    experimentID: "study",
    verifiedOwnerUid: "owner",
    storage: { state: "bound", provider: "googledrive" },
    github: { state: "bound", binding: githubBinding() },
  });
  expect(store.changes).toEqual([]);
  expect(http).not.toHaveBeenCalled();
  expect(JSON.stringify(res.body)).not.toContain("DO_NOT_EXPOSE");
});
test("binding inspection authorizes before any provider read", async () => {
  store.seed("experiments/study", { ...original(), owner: "another" });
  const res = await inspectLegacy();
  expect(res.statusCode).toBe(403);
  expect(http).not.toHaveBeenCalled();
  expect(store.changes).toEqual([]);
});
test("legacy destinations are inspected before the owner explicitly confirms them", async () => {
  legacy();
  marker = null;
  const inspected = await inspectLegacy();
  expect(inspected.statusCode).toBe(200);
  const preview = inspected.body.preview;
  expect(preview).toMatchObject({
    storage: { accountId: "drive-alice", folderId: "original-folder" },
    github: {
      repositoryId: "123",
      accountId: "9",
      repoName: "fixed-study",
      branch: "main",
    },
    fingerprint: expect.any(String),
    contextFingerprint: expect.any(String),
  });
  expect(store.read("experiments/study").githubBinding).toBeUndefined();
  expect(upload).not.toHaveBeenCalled();
  expect(http.mock.calls.some(([, options]) => options.method !== "GET")).toBe(
    false,
  );
  const confirmed = await bindingApi("configureExperimentBindings", {
    action: "confirm",
    ...preview,
  });
  expect(confirmed.statusCode).toBe(200);
  expect(store.read("experiments/study")).toMatchObject({
    storageBinding: storageBinding(),
    githubBinding: githubBinding(),
    active: false,
    sessions: 17,
  });
  expect(upload).not.toHaveBeenCalled();
  expect(marker.experimentID).toBe("study");
});
test("binding confirmation refuses a changed context before touching providers", async () => {
  legacy();
  const inspected = await inspectLegacy();
  expect(inspected.statusCode).toBe(200);
  const data = store.read("experiments/study");
  data.driveFolderId = "different-folder";
  store.seed("experiments/study", data);
  http.mockClear();
  const confirmed = await bindingApi("configureExperimentBindings", {
    action: "confirm",
    ...inspected.body.preview,
  });
  expect(confirmed.statusCode).toBe(409);
  expect(confirmed.body.code).toBe("BINDING_PREVIEW_STALE");
  expect(http).not.toHaveBeenCalled();
  expect(store.read("experiments/study").githubBinding).toBeUndefined();
});
test("changing the connected account after inspection cannot confirm the previous preview", async () => {
  legacy();
  const inspected = await inspectLegacy();
  expect(inspected.statusCode).toBe(200);
  driveAccount = "different-account";
  const confirmed = await bindingApi("configureExperimentBindings", {
    action: "confirm",
    ...inspected.body.preview,
  });
  expect(confirmed.statusCode).toBe(409);
  expect(confirmed.body.code).toBe("BINDING_PREVIEW_STALE");
  expect(store.read("experiments/study").storageBinding).toBeUndefined();
  expect(upload).not.toHaveBeenCalled();
});
test("a verified association cannot be retargeted through the legacy selection flow", async () => {
  const inspected = await bindingApi("configureExperimentBindings", {
    action: "inspect",
    selection: { repository: "alice/fixed-study" },
  });
  expect(inspected.statusCode).toBe(200);
  repository.id = 456;
  const confirmed = await bindingApi("configureExperimentBindings", {
    action: "confirm",
    ...inspected.body.preview,
  });
  expect(confirmed.statusCode).toBe(409);
  expect(upload).not.toHaveBeenCalled();
  expect(store.read("experiments/study").githubBinding.repositoryId).toBe(
    "123",
  );
});

test("republishing after a title change uses the bound repository and never ensures a folder by name", async () => {
  const res = await publish();
  expect(res.statusCode).toBe(200);
  expect(oldFolder).not.toHaveBeenCalled();
  expect(deleteFolder).not.toHaveBeenCalled();
  expect(upload).toHaveBeenCalledWith(
    "github-token",
    "alice",
    "fixed-study",
    "index.html",
    "<html/>",
    expect.any(String),
    "main",
  );
  expect(store.read("experiments/study")).toMatchObject({
    storageProvider: "googledrive",
    driveFolderId: "original-folder",
    active: false,
    sessions: 17,
    currentCondition: 4,
  });
});
test("requesting another storage provider fails before modifying any provider resource", async () => {
  const res = await publish({ storageProvider: "dropbox" });
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe("STORAGE_CHANGE_REQUIRES_MIGRATION");
  expect(oldFolder).not.toHaveBeenCalled();
  expect(deleteFolder).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  expect(store.read("experiments/study")).toMatchObject(original());
});
test("an omitted provider keeps the bound provider", async () => {
  const res = await publish({ storageProvider: undefined });
  expect(res.statusCode).toBe(200);
  expect(oldFolder).not.toHaveBeenCalled();
  expect(store.read("experiments/study").storageBinding).toMatchObject(
    storageBinding(),
  );
});
test.each(["account", "folder"])(
  "an unavailable storage %s cannot be replaced automatically",
  async (kind) => {
    if (kind === "account") driveAccount = "another-account";
    else folderAvailable = false;
    const res = await publish();
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("STORAGE_BINDING_UNAVAILABLE");
    expect(oldFolder).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(store.read("experiments/study").driveFolderId).toBe(
      "original-folder",
    );
  },
);
test.each(["account", "repository", "permission", "marker"])(
  "a changed GitHub %s prevents publication without adopting another target",
  async (kind) => {
    if (kind === "account") githubAccount = "88";
    if (kind === "repository") repository.id = 456;
    if (kind === "permission")
      repository.permissions = { push: false, admin: false };
    if (kind === "marker") marker.experimentID = "another-study";
    const res = await publish();
    expect(res.statusCode).toBe(409);
    expect(upload).not.toHaveBeenCalled();
    expect(deleteFolder).not.toHaveBeenCalled();
    expect(store.read("experiments/study").githubBinding).toEqual(
      githubBinding(),
    );
  },
);
test("an existing legacy repository requires an explicit selection before publication", async () => {
  const legacy = original();
  delete legacy.githubBinding;
  store.seed("experiments/study", legacy);
  const res = await publish();
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe("GITHUB_BINDING_REQUIRED");
  expect(upload).not.toHaveBeenCalled();
  expect(oldFolder).not.toHaveBeenCalled();
});
test.each(["dropbox", "osf"])(
  "%s republishes to the same verified resource even after its display path changes",
  async (provider) => {
    const data = original();
    data.storageProvider = provider;
    data.storageBinding =
      provider === "dropbox"
        ? {
            provider,
            accountId: "dbid:alice",
            folderId: "id:original",
            folderPath: "/ExpBuilder/Original",
          }
        : { provider, accountId: "osf-alice", folderId: "osf-component" };
    if (provider === "dropbox") data.dropboxFolder = "/ExpBuilder/Original";
    else {
      data.osfComponentId = "osf-component";
      data.osfUploadLink =
        "https://files.osf.io/v1/resources/osf-component/providers/osfstorage/";
    }
    store.seed("experiments/study", data);
    const res = await publish({ storageProvider: provider });
    expect(res.statusCode).toBe(200);
    expect(oldFolder).not.toHaveBeenCalled();
    expect(deleteFolder).not.toHaveBeenCalled();
    expect(store.read("experiments/study").storageBinding.folderId).toBe(
      data.storageBinding.folderId,
    );
    if (provider === "dropbox")
      expect(store.read("experiments/study").dropboxFolder).toBe(
        "/renamed-folder",
      );
  },
);
test("a first publication creates stable destinations and a rename reuses them", async () => {
  store.documents.delete("experiments/study");
  const first = await publish();
  expect(first.statusCode).toBe(201);
  const bound = store.read("experiments/study");
  expect(bound.storageBinding).toMatchObject({
    provider: "googledrive",
    accountId: "drive-alice",
    folderId: "new-folder",
  });
  expect(bound.githubBinding).toMatchObject({
    repositoryId: "999",
    accountId: "9",
    branch: "main",
  });
  expect(bound.githubBinding.repoName).not.toBe("renamed-study");
  expect(newMarker).toMatchObject({
    backendProjectId: projectId,
    experimentID: "study",
  });
  expect(driveFolders).toHaveLength(1);
  expect(oldFolder).not.toHaveBeenCalled();
  const second = await publish({ repoName: "another-title" });
  expect(second.statusCode).toBe(200);
  expect(driveFolders).toHaveLength(1);
  expect(
    http.mock.calls.filter(
      ([, options]) =>
        options.method === "POST" && options.body?.includes('"auto_init":true'),
    ),
  ).toHaveLength(1);
  expect(store.read("experiments/study").githubBinding.repositoryId).toBe(
    "999",
  );
});
test("a coinciding repository name is left intact and a different new repository is created", async () => {
  store.documents.delete("experiments/study");
  collision = true;
  const res = await publish();
  expect(res.statusCode).toBe(201);
  expect(newRepository.name.endsWith("-2")).toBe(true);
  expect(
    upload.mock.calls.every((args) => args[2] === newRepository.name),
  ).toBe(true);
});
test("an uncertain repository creation requires explicit review instead of adopting it by name", async () => {
  store.documents.delete("experiments/study");
  loseCreationResponse = true;
  const first = await publish();
  expect(first.statusCode).toBe(503);
  expect(upload).not.toHaveBeenCalled();
  loseCreationResponse = false;
  const second = await publish();
  expect(second.statusCode).toBe(409);
  expect(second.body.code).toBe("GITHUB_BINDING_REVIEW_REQUIRED");
  expect(
    http.mock.calls.filter(
      ([url, options]) =>
        new URL(url).pathname === "/user/repos" && options.method === "POST",
    ),
  ).toHaveLength(1);
  expect(upload).not.toHaveBeenCalled();
});
test.each(["dropbox", "osf"])(
  "%s prepares one verified destination and reuses it on a second publication",
  async (provider) => {
    store.documents.delete("experiments/study");
    store.seed("users/owner", { osfProjectId: "osf-root" });
    const first = await publish({ storageProvider: provider });
    expect(first.statusCode).toBe(201);
    expect(store.read("experiments/study").storageBinding).toMatchObject({
      provider,
      accountId: provider === "dropbox" ? "dbid:alice" : "osf-alice",
      folderId: provider === "dropbox" ? "id:new-folder" : "osf-new",
    });
    const second = await publish({
      storageProvider: provider,
      repoName: "changed-title",
    });
    expect(second.statusCode).toBe(200);
    if (provider === "dropbox") expect(dropboxFolders.size).toBe(2);
    else expect(osfNodes).toHaveLength(1);
    expect(oldFolder).not.toHaveBeenCalled();
    expect(deleteFolder).not.toHaveBeenCalled();
  },
);
test("two experiments cannot claim the same verified resources concurrently", async () => {
  const { withExperimentMutation } = await import(
    "../../experiment/mutation.js"
  );
  const { persistBindings, resourceClaims } = await import(
    "../../experiment/bindings/claims.js"
  );
  const data = original();
  delete data.githubBinding;
  delete data.storageBinding;
  store.seed("experiments/study", data);
  store.seed("experiments/second", { ...data, id: "second" });
  const results = await Promise.allSettled(
    ["study", "second"].map((experimentID) =>
      withExperimentMutation(
        { experimentID, uid: "owner", operation: "bind" },
        (mutation) =>
          persistBindings(
            mutation,
            {
              storageBinding: storageBinding(),
              githubBinding: githubBinding(),
            },
            resourceClaims(storageBinding(), githubBinding()),
          ),
      ),
    ),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(
    results.find((result) => result.status === "rejected").reason.code,
  ).toBe("RESOURCE_ALREADY_BOUND");
});
test("an expired worker cannot claim resources or store associations", async () => {
  const { withExperimentMutation } = await import(
    "../../experiment/mutation.js"
  );
  const { persistBindings, resourceClaims } = await import(
    "../../experiment/bindings/claims.js"
  );
  await expect(
    withExperimentMutation(
      { experimentID: "study", uid: "owner", operation: "bind" },
      async (mutation) => {
        await mutation.ref.update({
          mutationLease: {
            leaseToken: "another-worker",
            expiresAt: Date.now() + 60000,
          },
        });
        return persistBindings(
          mutation,
          { githubBinding: githubBinding() },
          resourceClaims(null, githubBinding()),
        );
      },
    ),
  ).rejects.toMatchObject({ code: "MUTATION_LEASE_LOST" });
  expect(
    [...store.documents.keys()].some((key) =>
      key.startsWith("experimentResourceBindings/"),
    ),
  ).toBe(false);
});
test("participant storage uses a bound token and resource, without creating another folder", async () => {
  const { getExperimentStorageToken } = await import(
    "../../experiment/bindings/runtime.js"
  );
  const data = original();
  const token = await getExperimentStorageToken(
    "googledrive",
    "owner",
    data,
    "study",
  );
  expect(token).toMatchObject({ success: true, access_token: "storage-token" });
  expect(data.driveFolderId).toBe("original-folder");
  expect(oldFolder).not.toHaveBeenCalled();
  driveAccount = "another-account";
  await expect(
    getExperimentStorageToken("googledrive", "owner", data, "study"),
  ).rejects.toMatchObject({ code: "STORAGE_BINDING_UNAVAILABLE" });
});
test("a legacy participant destination keeps its existing public token contract", async () => {
  const { getExperimentStorageToken } = await import(
    "../../experiment/bindings/runtime.js"
  );
  const data = original();
  delete data.storageBinding;
  await expect(
    getExperimentStorageToken("googledrive", "owner", data, "study"),
  ).resolves.toMatchObject({ success: true, access_token: "storage-token" });
  expect(http).not.toHaveBeenCalled();
});
test("the public participant upload rejects a reconnected account before sending any file", async () => {
  const { uploadParticipantFile } = await import(
    "../../experiment/participant-files/api/upload.js"
  );
  driveAccount = "another-account";
  const res = makeRes();
  await uploadParticipantFile(
    makeReq({
      method: "POST",
      body: {
        experimentID: "study",
        sessionId: "s",
        files: [
          {
            name: "result.txt",
            data: Buffer.from("private result").toString("base64"),
            type: "text/plain",
          },
        ],
      },
    }),
    res,
  );
  expect(res.statusCode).toBe(409);
  expect(res.jsonBody.code).toBe("STORAGE_BINDING_UNAVAILABLE");
  expect(participantUpload).not.toHaveBeenCalled();
});
test("remote deletion uses the pinned IDs and ignores a repository name hint", async () => {
  const { deleteExperiment } = await import("../../experiment/delete.js");
  const result = await deleteExperiment(
    "study",
    "owner",
    "an-unrelated-repository",
  );
  expect(result.success).toBe(true);
  expect(
    http.mock.calls
      .filter(([, options]) => options.method === "DELETE")
      .map(([url]) => new URL(url).pathname),
  ).toEqual(["/drive/v3/files/original-folder", "/repos/alice/fixed-study"]);
  expect(oldFolder).not.toHaveBeenCalled();
  expect(deleteFolder).not.toHaveBeenCalled();
  expect(store.read("experiments/study")).toBeUndefined();
});
test("remote deletion verifies both accounts before deleting either resource", async () => {
  const { deleteExperiment } = await import("../../experiment/delete.js");
  githubAccount = "another-account";
  await expect(deleteExperiment("study", "owner")).rejects.toMatchObject({
    code: "GITHUB_BINDING_UNAVAILABLE",
  });
  expect(
    http.mock.calls.some(([, options]) => options.method === "DELETE"),
  ).toBe(false);
  expect(store.read("experiments/study")).toMatchObject(original());
});
test("legacy remote deletion requires verified destinations instead of guessing a repository", async () => {
  const { deleteExperiment } = await import("../../experiment/delete.js");
  legacy();
  await expect(
    deleteExperiment("study", "owner", "fixed-study"),
  ).rejects.toMatchObject({ code: "GITHUB_BINDING_REQUIRED" });
  expect(deleteFolder).not.toHaveBeenCalled();
  expect(store.read("experiments/study")).toBeDefined();
});
test("partial deletion retains its progress so retry does not recreate or remove another folder", async () => {
  const { deleteExperiment } = await import("../../experiment/delete.js");
  failRepositoryDelete = true;
  await expect(deleteExperiment("study", "owner")).rejects.toMatchObject({
    status: 502,
  });
  expect(store.read("experiments/study").deletionProgress).toMatchObject({
    storageDeleted: true,
    repositoryDeleted: false,
  });
  failRepositoryDelete = false;
  repositoryAvailable = true;
  const result = await deleteExperiment("study", "owner");
  expect(result.success).toBe(true);
  expect(
    http.mock.calls.filter(
      ([url, options]) =>
        options.method === "DELETE" &&
        new URL(url).pathname === "/drive/v3/files/original-folder",
    ),
  ).toHaveLength(1);
  expect(oldFolder).not.toHaveBeenCalled();
});
test("publication refuses a different requested backend before reserving or calling providers", async () => {
  const res = await publish({ backendProjectId: "other-project" });
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe("BACKEND_CONTEXT_CHANGED");
  expect(store.changes).toEqual([]);
  expect(http).not.toHaveBeenCalled();
});
test("legacy review can locate a missing folder record only through an explicit ID", async () => {
  legacy();
  const data = store.read("experiments/study");
  delete data.driveFolderId;
  delete data.driveFolderPath;
  store.seed("experiments/study", data);
  const response = await bindingApi("configureExperimentBindings", {
    action: "inspect",
    selection: {
      repository: "alice/fixed-study",
      storageFolder: "original-folder",
    },
  });
  expect(response.statusCode).toBe(200);
  const confirm = await bindingApi("configureExperimentBindings", {
    action: "confirm",
    ...response.body.preview,
  });
  expect(confirm.statusCode).toBe(200);
  expect(store.read("experiments/study").storageBinding.folderId).toBe(
    "original-folder",
  );
});
test("a recorded folder identity cannot be retargeted by manual selection", async () => {
  const response = await bindingApi("configureExperimentBindings", {
    action: "inspect",
    selection: {
      repository: "alice/fixed-study",
      storageFolder: "different-folder",
    },
  });
  expect(response.statusCode).toBe(409);
  expect(
    http.mock.calls.some(([url]) => url.includes("different-folder")),
  ).toBe(false);
});
test("a confirmed preview can be safely retried after the response was lost", async () => {
  legacy();
  const inspected = await inspectLegacy();
  const body = { action: "confirm", ...inspected.body.preview };
  expect(
    (await bindingApi("configureExperimentBindings", body)).statusCode,
  ).toBe(200);
  http.mockClear();
  expect(
    (await bindingApi("configureExperimentBindings", body)).statusCode,
  ).toBe(200);
  expect(http).not.toHaveBeenCalled();
});

const inspectRepair = (resource) =>
  bindingApi("configureExperimentBindings", {
    action: "repair-inspect",
    resource,
  });
const confirmRepair = (preview) =>
  bindingApi("configureExperimentBindings", {
    action: "repair-confirm",
    ...preview,
    confirmReplacement: true,
    acknowledgeDataLoss: true,
  });
test("repair inspection verifies the account without creating or claiming a resource", async () => {
  folderAvailable = false;
  const response = await inspectRepair("storage");
  expect(response.statusCode).toBe(200);
  expect(response.body.preview).toMatchObject({
    kind: "repair",
    resource: "storage",
    previous: { folderId: "original-folder" },
    accountId: "drive-alice",
    contextFingerprint: expect.any(String),
    fingerprint: expect.any(String),
  });
  expect(store.changes).toEqual([]);
  expect(driveFolders).toHaveLength(0);
  expect(upload).not.toHaveBeenCalled();
});
test("repair requires explicit replacement and data-loss acknowledgement", async () => {
  folderAvailable = false;
  const inspected = await inspectRepair("storage");
  expect(inspected.statusCode).toBe(200);
  const response = await bindingApi("configureExperimentBindings", {
    action: "repair-confirm",
    ...inspected.body.preview,
  });
  expect(response.statusCode).toBe(400);
  expect(driveFolders).toHaveLength(0);
  expect(store.read("experiments/study").storageBinding).toEqual(
    storageBinding(),
  );
});
test("storage repair changes only its destination, preserving identity, pause, counters and historical metadata", async () => {
  folderAvailable = false;
  store.seed("experiments/study/session_metadata/old", {
    sessionId: "old",
    fileUrl: "https://original.invalid/result.csv",
    createdAt: "2025-01-01",
  });
  const inspected = await inspectRepair("storage");
  expect(inspected.statusCode).toBe(200);
  const response = await confirmRepair(inspected.body.preview);
  expect(response.statusCode).toBe(200);
  const data = store.read("experiments/study");
  expect(data).toMatchObject({
    id: "study",
    owner: "owner",
    active: false,
    sessions: 17,
    currentCondition: 4,
    storageBinding: { folderId: "new-folder", accountId: "drive-alice" },
    githubBinding: githubBinding(),
    legacyStorageBinding: storageBinding(),
  });
  expect(store.read("experiments/study/session_metadata/old").fileUrl).toBe(
    "https://original.invalid/result.csv",
  );
  expect(
    [...store.documents.keys()].filter((key) =>
      key.includes("/destination_history/"),
    ),
  ).toHaveLength(1);
  expect(newRepository).toBeNull();
  expect(upload).not.toHaveBeenCalled();
});
test("repository repair creates a distinct new repository without touching the data folder", async () => {
  repositoryAvailable = false;
  const inspected = await inspectRepair("github");
  expect(inspected.statusCode).toBe(200);
  const response = await confirmRepair(inspected.body.preview);
  expect(response.statusCode).toBe(200);
  expect(store.read("experiments/study")).toMatchObject({
    storageBinding: storageBinding(),
    githubBinding: { repositoryId: "999", accountId: "9" },
    sessions: 17,
    active: false,
  });
  expect(newRepository.name).not.toBe("fixed-study");
  expect(driveFolders).toHaveLength(0);
  expect(upload).not.toHaveBeenCalled();
  expect(response.body.repairResult).toMatchObject({
    resource: "github",
    requiresPublication: true,
    urlMayChange: true,
  });
});
test.each(["storage", "github"])(
  "repair rejects another %s account before any creation",
  async (resource) => {
    folderAvailable = false;
    repositoryAvailable = false;
    if (resource === "storage") driveAccount = "other";
    else githubAccount = "88";
    const response = await inspectRepair(resource);
    expect(response.statusCode).toBe(409);
    expect(driveFolders).toHaveLength(0);
    expect(newRepository).toBeNull();
    expect(store.changes).toEqual([]);
  },
);
test("a restored resource is reused instead of replaced", async () => {
  const response = await inspectRepair("storage");
  expect(response.statusCode).toBe(409);
  expect(response.body.code).toBe("REPAIR_NOT_NEEDED");
  expect(driveFolders).toHaveLength(0);
});
test("stale repair confirmation cannot replace a changed destination", async () => {
  folderAvailable = false;
  const inspected = await inspectRepair("storage");
  expect(inspected.statusCode).toBe(200);
  store.seed("experiments/study", {
    ...original(),
    storageBinding: { ...storageBinding(), folderId: "changed" },
  });
  http.mockClear();
  const response = await confirmRepair(inspected.body.preview);
  expect(response.statusCode).toBe(409);
  expect(response.body.code).toBe("BINDING_PREVIEW_STALE");
  expect(http).not.toHaveBeenCalled();
});
test("retrying a confirmed repair after losing its response creates no duplicate resource or history", async () => {
  folderAvailable = false;
  const inspected = await inspectRepair("storage");
  expect(inspected.statusCode).toBe(200);
  expect((await confirmRepair(inspected.body.preview)).statusCode).toBe(200);
  http.mockClear();
  expect((await confirmRepair(inspected.body.preview)).statusCode).toBe(200);
  expect(http).not.toHaveBeenCalled();
  expect(driveFolders).toHaveLength(1);
  expect(
    [...store.documents.keys()].filter((key) =>
      key.includes("/destination_history/"),
    ),
  ).toHaveLength(1);
});
test("historical sessions keep the old destination while new sessions use the repaired one", async () => {
  folderAvailable = false;
  store.seed("experiments/study/session_metadata/old", {
    sessionId: "old",
    fileUrl: "https://original.invalid/result.csv",
  });
  const inspected = await inspectRepair("storage");
  expect(inspected.statusCode).toBe(200);
  expect((await confirmRepair(inspected.body.preview)).statusCode).toBe(200);
  const { getExperimentStorageToken } = await import(
    "../../experiment/bindings/runtime.js"
  );
  const old = store.read("experiments/study");
  await expect(
    getExperimentStorageToken("googledrive", "owner", old, "study", "old"),
  ).rejects.toMatchObject({ code: "STORAGE_BINDING_UNAVAILABLE" });
  const fresh = store.read("experiments/study");
  await expect(
    getExperimentStorageToken("googledrive", "owner", fresh, "study", "new"),
  ).resolves.toMatchObject({ success: true });
  expect(fresh.driveFolderId).toBe("new-folder");
  expect(
    store.read("experiments/study/session_metadata/new").storageBinding
      .folderId,
  ).toBe("new-folder");
  folderAvailable = true;
  await getExperimentStorageToken("googledrive", "owner", old, "study", "old");
  expect(old.driveFolderId).toBe("original-folder");
});
test("legacy Drive path verification is read-only and rejects ambiguous path components", async () => {
  legacy();
  const data = store.read("experiments/study");
  delete data.driveFolderId;
  store.seed("experiments/study", data);
  const provider = http.getMockImplementation();
  http.mockImplementation(async (url, options) => {
    const parsed = new URL(url),
      query = parsed.searchParams.get("q");
    if (
      parsed.pathname === "/drive/v3/files" &&
      query?.includes("name = 'ExpBuilder'")
    )
      return reply(200, { files: [{ id: "app-root" }] });
    if (
      parsed.pathname === "/drive/v3/files" &&
      query?.includes("name = 'Original'")
    )
      return reply(200, { files: [{ id: "original-folder" }] });
    return provider(url, options);
  });
  const inspected = await inspectLegacy();
  expect(inspected.statusCode).toBe(200);
  expect(inspected.body.preview.storage.folderId).toBe("original-folder");
  expect(store.changes).toEqual([]);
  expect(driveFolders).toHaveLength(0);
  http.mockImplementation(async (url, options) =>
    new URL(url).pathname === "/drive/v3/files"
      ? reply(200, { files: [{ id: "a" }, { id: "b" }] })
      : provider(url, options),
  );
  expect((await inspectLegacy()).body.code).toBe("STORAGE_BINDING_AMBIGUOUS");
});
test("repair stops on a transient provider failure without creating another resource", async () => {
  const provider = http.getMockImplementation();
  http.mockImplementation(async (url, options) =>
    new URL(url).pathname === "/drive/v3/files/original-folder"
      ? reply(503, {})
      : provider(url, options),
  );
  const response = await inspectRepair("storage");
  expect(response.statusCode).toBe(502);
  expect(driveFolders).toHaveLength(0);
  expect(store.changes).toEqual([]);
});
test("an uncertain replacement repository can be explicitly inspected and confirmed without creating a duplicate", async () => {
  repositoryAvailable = false;
  const inspected = await inspectRepair("github");
  expect(inspected.statusCode).toBe(200);
  loseCreationResponse = true;
  expect((await confirmRepair(inspected.body.preview)).statusCode).toBe(503);
  expect(store.read("experiments/study").githubBinding.repositoryId).toBe(
    "123",
  );
  loseCreationResponse = false;
  const recovered = await bindingApi("configureExperimentBindings", {
    action: "repair-inspect",
    resource: "github",
    selection: { repository: `alice/${newRepository.name}` },
  });
  expect(recovered.statusCode).toBe(200);
  expect(recovered.body.preview.replacement.repositoryId).toBe("999");
  expect((await confirmRepair(recovered.body.preview)).statusCode).toBe(200);
  expect(
    http.mock.calls.filter(
      ([url, options]) =>
        new URL(url).pathname === "/user/repos" && options.method === "POST",
    ),
  ).toHaveLength(1);
});
test.each(["dropbox", "osf"])(
  "%s repair preserves the other destination and same provider account",
  async (provider) => {
    const data = original();
    data.storageProvider = provider;
    data.storageBinding =
      provider === "dropbox"
        ? {
            provider,
            accountId: "dbid:alice",
            folderId: "id:original",
            folderPath: "/ExpBuilder/Original",
          }
        : {
            provider,
            accountId: "osf-alice",
            folderId: "osf-component",
            rootFolderId: "osf-root",
          };
    store.seed("experiments/study", data);
    store.seed("users/owner", { osfProjectId: "osf-root" });
    folderAvailable = false;
    const inspected = await inspectRepair("storage");
    expect(inspected.statusCode).toBe(200);
    expect((await confirmRepair(inspected.body.preview)).statusCode).toBe(200);
    expect(store.read("experiments/study")).toMatchObject({
      storageProvider: provider,
      storageBinding: {
        accountId: data.storageBinding.accountId,
        folderId: provider === "dropbox" ? "id:new-folder" : "osf-new",
      },
      githubBinding: githubBinding(),
      sessions: 17,
    });
  },
);
test.each(["dropbox", "osf"])(
  "%s deletion addresses the verified resource ID directly",
  async (provider) => {
    const data = original();
    data.storageProvider = provider;
    data.storageBinding =
      provider === "dropbox"
        ? {
            provider,
            accountId: "dbid:alice",
            folderId: "id:original",
            folderPath: "/ExpBuilder/Original",
          }
        : { provider, accountId: "osf-alice", folderId: "osf-component" };
    store.seed("experiments/study", data);
    const prior = http.getMockImplementation();
    http.mockImplementation(async (url, options) =>
      new URL(url).pathname === "/2/files/delete_v2" ||
      (options.method === "DELETE" &&
        new URL(url).pathname === "/v2/nodes/osf-component/")
        ? reply(204, {})
        : prior(url, options),
    );
    const { deleteExperiment } = await import("../../experiment/delete.js");
    expect((await deleteExperiment("study", "owner")).success).toBe(true);
    if (provider === "dropbox")
      expect(
        http.mock.calls.find(
          ([url]) => new URL(url).pathname === "/2/files/delete_v2",
        )[1].body,
      ).toBe(JSON.stringify({ path: "id:original" }));
    expect(deleteFolder).not.toHaveBeenCalled();
  },
);
test.each([
  { source: { branch: "other", path: "/" } },
  { build_type: "workflow" },
  { source: { branch: "main", path: "/docs" } },
])(
  "republish refuses a changed Pages configuration before uploading: %j",
  async (pages) => {
    const provider = http.getMockImplementation();
    http.mockImplementation(async (url, options) =>
      new URL(url).pathname.endsWith("/pages")
        ? reply(200, pages)
        : provider(url, options),
    );
    const res = await publish();
    expect(res.statusCode).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  },
);
test("a pending repair blocks ordinary publication even if the old destination becomes accessible again", async () => {
  folderAvailable = false;
  const inspected = await inspectRepair("storage");
  expect(inspected.statusCode).toBe(200);
  const data = store.read("experiments/study");
  store.seed("experiments/study", {
    ...data,
    destinationRepair: { status: "preparing", resource: "storage" },
  });
  folderAvailable = true;
  http.mockClear();
  const response = await publish();
  expect(response.statusCode).toBe(409);
  expect(response.body.code).toBe("REPAIR_IN_PROGRESS");
  expect(upload).not.toHaveBeenCalled();
  expect(http).not.toHaveBeenCalled();
});
test("final deletion removes destination history metadata without deleting the preserved old resource", async () => {
  folderAvailable = false;
  const inspected = await inspectRepair("storage");
  expect((await confirmRepair(inspected.body.preview)).statusCode).toBe(200);
  const provider = http.getMockImplementation();
  http.mockImplementation(async (url, options) =>
    options.method === "DELETE" &&
    new URL(url).pathname === "/drive/v3/files/new-folder"
      ? reply(204, {})
      : provider(url, options),
  );
  driveFolders[0].capabilities.canDelete = true;
  const { deleteExperiment } = await import("../../experiment/delete.js");
  expect((await deleteExperiment("study", "owner")).success).toBe(true);
  expect(
    [...store.documents.keys()].some((key) =>
      key.includes("/destination_history/"),
    ),
  ).toBe(false);
  expect(
    http.mock.calls.some(
      ([url, options]) =>
        options.method === "DELETE" &&
        new URL(url).pathname === "/drive/v3/files/original-folder",
    ),
  ).toBe(false);
});
test.each([
  [429, { message: "Too many requests" }],
  [
    403,
    {
      error: {
        errors: [{ reason: "userRateLimitExceeded" }],
        message: "Rate Limit Exceeded",
      },
    },
  ],
])(
  "a provider rate limit (%s) cannot authorize replacement",
  async (status, body) => {
    const provider = http.getMockImplementation();
    http.mockImplementation(async (url, options) =>
      new URL(url).pathname === "/drive/v3/files/original-folder"
        ? reply(status, body)
        : provider(url, options),
    );
    const response = await inspectRepair("storage");
    expect(response.statusCode).toBe(503);
    expect(driveFolders).toHaveLength(0);
    expect(store.changes).toEqual([]);
  },
);
test("an invalid provider request is reported rather than offered as proof that replacement is needed", async () => {
  const provider = http.getMockImplementation();
  http.mockImplementation(async (url, options) =>
    new URL(url).pathname === "/drive/v3/files/original-folder"
      ? reply(400, { message: "Bad request" })
      : provider(url, options),
  );
  const response = await inspectRepair("storage");
  expect(response.statusCode).toBe(409);
  expect(response.body.preview).toBeUndefined();
  expect(driveFolders).toHaveLength(0);
});
