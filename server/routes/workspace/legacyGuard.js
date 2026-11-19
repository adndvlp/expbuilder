import { withDbRead } from "../../modules/session-persistence/dbQueue.js";

export async function legacyWorkspaceGuard(req, res, next) {
  const match = req.path.match(
    /^\/api\/(trial|trials|loop|loops|timeline|experiment-graph|loop-branch|loop-branch-levels|timeline-code)\/([^/]+)(?:\/[^/]+)?$/,
  );
  if (!match) return next();
  try {
    const converted = await withDbRead((data) =>
      data.trials.some(
        (d) =>
          d.experimentID === decodeURIComponent(match[2]) &&
          d.workspaceSchemaVersion === 2,
      ),
    );
    if (!converted) return next();
    if (req.method !== "GET" || req.get("X-Workspace-Schema") !== "2")
      return res.status(409).json({
        success: false,
        code: "WORKSPACE_SCHEMA_UNSUPPORTED",
        error: "Use the version 2 workspace commands for this experiment",
      });
    next();
  } catch (error) {
    res.status(error.status ?? 500).json({
      success: false,
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }
}
