export const store = {
  github: {
    users: new Map(),
    repos: new Map(),
    contents: new Map(),
    pages: new Map(),
  },
  dropbox: {
    tokens: new Map(),
    entries: new Map(),
    files: new Map(),
    sharedLinks: new Map(),
  },
  drive: {
    tokens: new Map(),
    files: new Map(),
  },
  osf: {
    tokens: new Map(),
    nodes: new Map(),
    files: new Map(),
  },
};

export function nextId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resetStore() {
  store.github.users.clear();
  store.github.repos.clear();
  store.github.contents.clear();
  store.github.pages.clear();
  store.dropbox.tokens.clear();
  store.dropbox.entries.clear();
  store.dropbox.files.clear();
  store.dropbox.sharedLinks.clear();
  store.drive.tokens.clear();
  store.drive.files.clear();
  store.osf.tokens.clear();
  store.osf.nodes.clear();
  store.osf.files.clear();
}
