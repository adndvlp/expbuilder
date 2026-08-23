export function installExpBuilderRuntime(targetWindow, targetDocument) {
  if (targetWindow.ExpBuilderRuntime) return targetWindow.ExpBuilderRuntime;

  const events = [];
  const errors = [];
  let sequence = 0;
  let lastErrorKey = "";
  let lastErrorAt = 0;

  function serializeError(value) {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (value && typeof value === "object") {
      return {
        name: value.name || "Error",
        message: value.message || JSON.stringify(value),
        stack: value.stack,
      };
    }
    return { name: "Error", message: String(value), stack: undefined };
  }

  function emit(type, payload) {
    const event = {
      sequence: ++sequence,
      timestamp: new Date().toISOString(),
      type,
      payload: payload || {},
    };
    events.push(event);
    if (typeof targetWindow.CustomEvent === "function") {
      targetWindow.dispatchEvent(
        new targetWindow.CustomEvent("expbuilder:runtime-event", {
          detail: event,
        }),
      );
    }
    return event;
  }

  function showError(errorRecord) {
    let overlay = targetDocument.getElementById("expbuilder-runtime-error");
    if (!overlay) {
      overlay = targetDocument.createElement("div");
      overlay.id = "expbuilder-runtime-error";
      overlay.setAttribute("role", "alert");
      overlay.setAttribute("aria-live", "assertive");
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:24px",
        "background:#f7f7f7",
        "color:#171717",
        "font-family:system-ui,sans-serif",
      ].join(";");
      overlay.innerHTML =
        '<div style="max-width:620px;text-align:center">' +
        '<h1 style="font-size:24px;margin:0 0 12px">The experiment could not continue</h1>' +
        '<p style="margin:0 0 8px">Please contact the experiment administrator.</p>' +
        '<p data-runtime-error-code style="font-family:monospace;margin:0"></p>' +
        "</div>";
      targetDocument.body.appendChild(overlay);
    }
    const code = overlay.querySelector("[data-runtime-error-code]");
    if (code) code.textContent = `Error reference: ${errorRecord.code}`;
    const loading = targetDocument.getElementById("jspsych-loading-overlay");
    if (loading) loading.style.display = "none";
  }

  function reportError(value, context) {
    const serialized = serializeError(value);
    const errorKey = `${serialized.name}:${serialized.message}`;
    const now = Date.now();
    if (errorKey === lastErrorKey && now - lastErrorAt < 50) {
      return errors[errors.length - 1];
    }
    lastErrorKey = errorKey;
    lastErrorAt = now;
    const record = {
      code: `RUNTIME-${String(errors.length + 1).padStart(3, "0")}`,
      ...serialized,
      context: context || {},
    };
    errors.push(record);
    emit("runtime-error", record);
    showError(record);
    return record;
  }

  const api = {
    version: 2,
    events,
    errors,
    emit,
    // Kept for generated artifacts created before the canonical emit API.
    trace: emit,
    reportError,
    snapshot: () => ({ events: events.slice(), errors: errors.slice() }),
  };
  targetWindow.ExpBuilderRuntime = api;

  const originalConsoleError = targetWindow.console.error.bind(
    targetWindow.console,
  );
  targetWindow.console.error = function (...args) {
    originalConsoleError(...args);
    reportError(args[0], { source: "console.error", arguments: args.slice(1) });
  };

  targetWindow.addEventListener("error", function (event) {
    if (event.target && event.target !== targetWindow) {
      const target = event.target;
      reportError(`Failed to load ${target.src || target.href || target.tagName}`,
        { source: "resource", tagName: target.tagName });
      return;
    }
    reportError(event.error || event.message, {
      source: "window.error",
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  }, true);

  targetWindow.addEventListener("unhandledrejection", function (event) {
    reportError(event.reason, { source: "unhandledrejection" });
  });

  emit("runtime-ready", { version: api.version });
  return api;
}

export function getRuntimeGuardSource() {
  return `(${installExpBuilderRuntime.toString()})(window, document);`;
}
