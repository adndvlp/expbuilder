export function applyRuntimeCanvasContext(editor: any) {
  const body = editor?.Canvas?.getBody?.();
  if (!body) return;
  Object.assign(body.style, {
    margin: "0",
    width: "100%",
    minWidth: "100%",
    minHeight: "100vh",
    color: "#000000",
    fontFamily: '"Open Sans", "Arial", sans-serif',
    fontSize: "18px",
    lineHeight: "1.6em",
    textAlign: "left",
  });
  const wrapper = body.querySelector("#wrapper") as HTMLElement | null;
  if (wrapper) {
    Object.assign(wrapper.style, {
      width: "100%",
      minWidth: "100%",
      minHeight: "100vh",
      padding: "32px",
      boxSizing: "border-box",
    });
  }
}
