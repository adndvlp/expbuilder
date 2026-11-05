import { useState, useRef, useMemo, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { toModel } from "../../../../../../../shared/experiment-workspace/documentAdapter.js";
import useTrials from "../../../hooks/useTrials";
import { useExperimentID } from "../../../hooks/useExperimentID";
import { workspaceClient } from "../../../modules/experiment-workspace/browserClient";
import { getModel } from "./model.js";
import { layout as arrange } from "./layout.js";
import {
  project,
  translatedProjection,
  ghostProjection,
} from "./projection.js";
import { useWorkspaceSelection } from "./useWorkspaceSelection.js";
import { useWorkspaceConnections } from "./useWorkspaceConnections.js";
import { useWorkspaceDrag } from "./useWorkspaceDrag.js";
import { useWorkspaceShortcuts } from "./useWorkspaceShortcuts.js";
import { getCanvasLayoutBounds } from "../services/canvasLayoutBounds";
import { getIsDarkMode } from "../utils/styleUtils";
export function useWorkspaceController(doc) {
  const trials = useTrials(),
    experimentID = useExperimentID(),
    flow = useReactFlow(),
    element = useRef(null),
    M = getModel();
  const { setSelectedTrial, setSelectedLoop } = trials;
  const selection = useWorkspaceSelection(doc),
    [expanded, setExpanded] = useState(new Set()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [branch, setBranch] = useState(false),
    [connectionModal, setConnectionModal] = useState(null);
  const gesture = useRef(false);
  useEffect(() => {
    if (
      !connectionModal &&
      !branch &&
      window.document.activeElement === window.document.body
    )
      element.current?.focus({ preventScroll: true });
  }, [connectionModal, branch]);
  const state = useMemo(() => {
    const s = toModel(doc);
    s.loops.forEach((l) => {
      l.expanded = expanded.has(l.id);
    });
    return s;
  }, [doc, expanded]);
  const layout = useMemo(() => arrange(state), [state]);
  const selectedId =
    selection.selection?.type === "item" ? selection.selection.id : null;
  const selectedTrial = doc.trials.find((t) => String(t.id) === selectedId);
  const restoreFocus = () =>
    requestAnimationFrame(() => {
      if (window.document.activeElement === window.document.body)
        element.current?.focus({ preventScroll: true });
    });
  const adopt = (response) => {
    if (response) trials.applyGraphSnapshot(response.graph);
    return response;
  };
  const execute = async (
    kind,
    args = {},
    expectedRevision = doc.authoringRevision,
  ) => {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const logical = M.copy(state);
      logical.loops.forEach((l) => {
        l.expanded = true;
      });
      const layoutBefore = {
        ...arrange(logical).positions,
        ...layout.positions,
      };
      const response = adopt(
        await workspaceClient.command(
          experimentID,
          kind,
          { ...args, layoutBefore },
          expectedRevision,
        ),
      );
      if (kind === "pasteItems")
        selection.setSelection({
          type: "items",
          ids: response.result.ids.map((id) =>
            String(response.idMap[id] ?? id),
          ),
        });
      if (kind === "groupLoop") selection.select(String(response.result));
      return response;
    } catch (e) {
      if (e.status === 409 && e.responseBody?.code === "REVISION_CONFLICT") {
        setConnectionModal(null);
        adopt(await workspaceClient.load(experimentID, true));
      }
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
      restoreFocus();
    }
  };
  const connection = useWorkspaceConnections(
    state,
    execute,
    selection.select,
    doc.authoringRevision,
    connectionModal,
    setConnectionModal,
  );
  const toggle = (id) =>
    setExpanded((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const projection = project(
    state,
    layout,
    selection.selection,
    { onAdd: connection.add, onToggle: toggle, onCheck: selection.check },
    M,
  );
  const dragging = useWorkspaceDrag(state, layout, execute),
    translated = translatedProjection(projection, dragging.offset);
  const shown =
    ghostProjection(
      state,
      dragging.proposal,
      projection,
      translated.nodes,
      M,
    ) ?? translated;
  const onDelete = async () => {
    const s = selection.selection;
    if (!s) return;
    if (s.type === "edge") {
      const edge = layout.flowEdges.find((e) => e.data.selectionId === s.id);
      if (!edge?.data.editable) return;
      const actual = M.connections(state).find(
        (e) => e.id === edge.data.semantic,
      );
      if (
        actual &&
        (await execute("removeConnection", {
          sourceId: actual.source,
          targetId: actual.target,
          edgeRefs: edge.data.semantics,
        }))
      )
        selection.clear();
    } else if (
      await execute("deleteItems", { ids: [...selection.selectedIds] })
    )
      selection.clear();
    element.current?.focus({ preventScroll: true });
  };
  const travel = async (redo) => {
    if (busy) return;
    setBusy(true);
    try {
      adopt(await workspaceClient[redo ? "redo" : "undo"](experimentID));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      restoreFocus();
    }
  };
  useWorkspaceShortcuts({
    element,
    selection: selection.selection,
    document: doc,
    blocked: () =>
      busy ||
      branch ||
      connection.modal ||
      gesture.current ||
      selection.rectangle.current?.active,
    onDelete,
    execute,
    undo: () => travel(false),
    redo: () => travel(true),
    drag: dragging,
  });
  useEffect(() => {
    const id =
      selection.selection?.type === "item" ? selection.selection.id : null;
    const trial = doc.trials.find((t) => String(t.id) === id),
      loop = doc.loops.find((l) => String(l.id) === id);
    setSelectedTrial(trial ?? null);
    setSelectedLoop(loop ?? null);
  }, [selection.selection, doc, setSelectedTrial, setSelectedLoop]);
  const addLoose = async () => {
    const bounds = element.current.getBoundingClientRect(),
      position = flow.screenToFlowPosition({
        x: bounds.left + bounds.width * 0.65,
        y: bounds.top + bounds.height * 0.45,
      });
    const result = await execute("addTrial", { position });
    if (result) selection.select(String(result.result));
  };
  const createLoop = () => {
    if (selection.selectedIds.size)
      void execute("groupLoop", { ids: [...selection.selectedIds] });
  };
  const isDark = getIsDarkMode(),
    topology = JSON.stringify([
      state.entryId,
      state.trials.map((t) => [t.id, t.defaultNextTrialId, t.thenGoTo]),
      state.loops.map((l) => [l.id, l.expanded, l.entryId, l.nextId]),
    ]);
  const bounds = getCanvasLayoutBounds(projection.nodes, projection.edges);
  const engage = () => {
      gesture.current = true;
    },
    release = () =>
      requestAnimationFrame(() => {
        gesture.current = false;
      });
  return {
    clearPane: () => {
      if (!gesture.current) selection.clear();
    },
    experimentID,
    element,
    selection,
    busy,
    error,
    setError,
    branch,
    setBranch,
    selectedTrial,
    state,
    M,
    connection,
    shown,
    topology,
    bounds,
    engage,
    release,
    addLoose,
    createLoop,
    onDelete,
    travel,
    isDark,
    dragging,
    layout,
  };
}
