import { getRuntimeGuardSource } from "../../runtime/runtimeGuard.js";

describe("experiment runtime guard", () => {
  test("serializes a standalone guard that installs before generated code", () => {
    const source = getRuntimeGuardSource();

    expect(source).toContain("ExpBuilderRuntime");
    expect(source).toContain("unhandledrejection");
    expect(source).toContain("expbuilder-runtime-error");
    expect(source).toContain("runtime-error");
    expect(source).toContain("emit,");
    expect(source).toContain("trace: emit");
    expect(source).not.toContain("import ");
  });
});
