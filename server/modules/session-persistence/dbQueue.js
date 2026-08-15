import { AsyncLocalStorage } from "node:async_hooks";
import { db, ensureDbData } from "../../utils/db.js";

const lockContext = new AsyncLocalStorage();
let queueTail = Promise.resolve();

export async function withDbLock(operation) {
  const currentLock = lockContext.getStore();
  if (currentLock?.active === true) return operation();

  const previous = queueTail.catch(() => undefined);
  let release;
  queueTail = new Promise((resolve) => {
    release = resolve;
  });

  await previous;
  const lock = { active: true };
  try {
    return await lockContext.run(lock, operation);
  } finally {
    lock.active = false;
    release();
  }
}

export function serializeDbRequest(req, res, next) {
  const method = req.method || "GET";
  if (
    (method === "POST" &&
      (req.path === "/api/chat/stream" || req.path === "/api/chat")) ||
    (method === "POST" &&
      (req.path === "/api/create-tunnel" ||
        req.path === "/api/close-tunnel")) ||
    (method === "POST" && req.path.startsWith("/api/upload-files/")) ||
    (method === "GET" && req.path.startsWith("/api/upload-jobs/")) ||
    (method === "GET" && /^\/[^/]+\/?$/.test(req.path)) ||
    (method === "GET" && /^\/[^/]+\/preview\/?$/.test(req.path)) ||
    (method === "GET" && req.path.startsWith("/api/participant-files-serve/")) ||
    (method === "GET" && /^\/[^/]+\/(?:img|aud|vid|others)\//.test(req.path))
  ) {
    next();
    return;
  }
  withDbLock(
    async () => {
      await db.read();
      ensureDbData();
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        res.once("finish", finish);
        res.once("close", () => {
          if (res.writableFinished) finish();
        });
        if (typeof res.end === "function") {
          const originalEnd = res.end;
          res.end = function (...args) {
            try {
              return originalEnd.apply(this, args);
            } finally {
              finish();
            }
          };
        }
        try {
          next();
        } catch (error) {
          reject(error);
        }
      });
    },
  ).catch(next);
}
