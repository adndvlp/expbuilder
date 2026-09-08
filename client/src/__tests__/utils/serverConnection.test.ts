import { describe, expect, it, vi } from "vitest";
import {
  CONNECTION_CODE_PREFIX,
  connectToSharedServer,
  createConnectionCode,
  getConnectionMode,
  readConnectionCode,
} from "../../lib/serverConnection";

const firebaseConfig = {
  apiKey: "api-key",
  authDomain: "my-project.firebaseapp.com",
  projectId: "my-project",
  storageBucket: "my-project.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:abc",
};

describe("shared server connection codes", () => {
  it("creates a versioned code with only the public Firebase config", () => {
    const code = createConnectionCode({
      ...firebaseConfig,
      connectionMode: "owner",
      oauthSecret: "must-not-be-shared",
    });

    expect(code.startsWith(`${CONNECTION_CODE_PREFIX}.`)).toBe(true);
    expect(code).not.toContain("must-not-be-shared");
    expect(readConnectionCode(code)).toEqual(firebaseConfig);
  });

  it("accepts whitespace from copied codes", () => {
    const code = createConnectionCode(firebaseConfig);
    expect(
      readConnectionCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `),
    ).toEqual(firebaseConfig);
  });

  it("rejects malformed, incomplete, unsupported and oversized codes", () => {
    expect(() => readConnectionCode("not-a-code")).toThrow(
      "This connection code is not valid.",
    );
    expect(() => createConnectionCode({ apiKey: "x" })).toThrow(
      "This connection code is incomplete.",
    );
    expect(() =>
      createConnectionCode({ ...firebaseConfig, projectId: "INVALID" }),
    ).toThrow("This connection code has an invalid server ID.");

    const unsupportedPayload = btoa(
      JSON.stringify({ v: 2, firebase: firebaseConfig }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const unsupported = `${CONNECTION_CODE_PREFIX}.${unsupportedPayload}`;
    expect(() => readConnectionCode(unsupported)).toThrow(
      "This connection code was made by a newer app version.",
    );
    expect(() =>
      readConnectionCode(`${CONNECTION_CODE_PREFIX}.${"a".repeat(12_001)}`),
    ).toThrow("This connection code is not valid.");
  });

  it("stores a shared connection and requests an app restart", async () => {
    const writeFirebaseConfig = vi.fn(async () => ({ success: true }));
    const restartApp = vi.fn(async () => ({ success: true }));
    const result = await connectToSharedServer(
      createConnectionCode(firebaseConfig),
      {
        writeFirebaseConfig,
        restartApp,
      } as unknown as ElectronAPI,
    );

    expect(writeFirebaseConfig).toHaveBeenCalledWith({
      ...firebaseConfig,
      connectionMode: "member",
    });
    expect(restartApp).toHaveBeenCalled();
    expect(result).toEqual({ projectId: "my-project", restarting: true });
  });

  it("reports storage failures and supports a manual restart fallback", async () => {
    await expect(
      connectToSharedServer(createConnectionCode(firebaseConfig), {
        writeFirebaseConfig: vi.fn(async () => ({
          success: false,
          error: "disk full",
        })),
      } as unknown as ElectronAPI),
    ).rejects.toThrow("disk full");

    await expect(
      connectToSharedServer(createConnectionCode(firebaseConfig), {
        writeFirebaseConfig: vi.fn(async () => ({ success: false })),
      } as unknown as ElectronAPI),
    ).rejects.toThrow("The connection could not be saved.");

    await expect(
      connectToSharedServer(createConnectionCode(firebaseConfig), {
        writeFirebaseConfig: vi.fn(async () => ({ success: true })),
      } as unknown as ElectronAPI),
    ).resolves.toEqual({ projectId: "my-project", restarting: false });

    await expect(
      connectToSharedServer(createConnectionCode(firebaseConfig), undefined),
    ).rejects.toThrow("Shared servers are available in the desktop app.");
  });

  it("treats old local configurations as owner installations", () => {
    expect(getConnectionMode(null)).toBeNull();
    expect(getConnectionMode(firebaseConfig)).toBe("owner");
    expect(
      getConnectionMode({ ...firebaseConfig, connectionMode: "member" }),
    ).toBe("member");
  });
});
