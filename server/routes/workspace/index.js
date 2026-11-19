import { workspaceRecords } from "./records.js";
import { findWorkspaceDocument } from "./document.js";
import { Router } from "express";
import {
  withDbRead,
  withDbMutation,
} from "../../modules/session-persistence/dbQueue.js";
import { workspaceSnapshot, revisionOf } from "./snapshot.js";
import { executeWorkspaceCommand } from "./executeCommand.js";
import { legacyWorkspaceGuard } from "./legacyGuard.js";

const router = Router();
const error = (res, e) =>
  res.status(e.status ?? 500).json({
    success: false,
    error: e.message,
    ...(e.code ? { code: e.code } : {}),
    ...(e.levels ? { levels: e.levels } : {}),
  });
router.get("/api/workspace/:experimentID", async (req, res) => {
  try {
    const result = await withDbRead((data) => {
      const doc = findWorkspaceDocument(data, req.params.experimentID);
      if (!doc)
        throw Object.assign(Error("Experiment not found"), { status: 404 });
      return workspaceSnapshot(doc);
    });
    res.json(result);
  } catch (e) {
    error(res, e);
  }
});
router.get("/api/workspace/:experimentID/records", async (req, res) => {
  try {
    const result = await withDbRead((data) => {
      const doc = findWorkspaceDocument(data, req.params.experimentID);
      if (!doc)
        throw Object.assign(Error("Experiment not found"), { status: 404 });
      const ids = new Set(
        String(req.query.ids ?? "")
          .split(",")
          .filter(Boolean),
      );
      if (
        req.query.revision != null &&
        String(req.query.revision) !== String(doc.authoringRevision)
      )
        throw Object.assign(Error("The workspace revision changed"), {
          status: 409,
          code: "REVISION_CONFLICT",
        });
      return {
        success: true,
        revision: revisionOf(doc),
        records: workspaceRecords(doc, ids),
      };
    });
    res.json(result);
  } catch (e) {
    error(res, e);
  }
});
router.post("/api/workspace/:experimentID/commands", async (req, res) => {
  try {
    const result = await withDbMutation((data) =>
      executeWorkspaceCommand(
        data,
        req.params.experimentID,
        req.body,
        req.get("Idempotency-Key"),
      ),
    );
    res.json(result);
  } catch (e) {
    error(res, e);
  }
});
router.use(legacyWorkspaceGuard);
export default router;
