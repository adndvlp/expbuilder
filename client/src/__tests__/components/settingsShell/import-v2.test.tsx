import { fetchMock, okJson, registerSettingsShellHooks } from "./testHarness";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Settings from "../../../pages/Settings";

const preview = (kind = "backup") => ({
  success: true,
  importID: "preview-1",
  kind,
  formatVersion: 2,
  modes: kind === "portable" ? ["copy"] : ["copy", "restore"],
  entries: [
    {
      entryId: "one",
      experimentID: "origin",
      name: "Incoming study",
      existingName: "Local study",
      collision: true,
      warnings: [],
      mediaCount: 2,
    },
  ],
});
const choose = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["zip"], "study.zip", { type: "application/zip" })],
      },
    });
  });
};

describe("Explicit package import", () => {
  registerSettingsShellHooks();

  it("inspects before mutation and creates independent copies only after confirmation", async () => {
    fetchMock().mockImplementation(async (url: string) =>
      url.endsWith("/inspect")
        ? okJson(preview())
        : url.endsWith("/apply")
          ? okJson({ success: true, imported: 1 })
          : okJson({ experiments: [] }),
    );
    const { container } = render(<Settings />);
    await choose(container);
    expect(
      screen.getByRole("dialog", { name: "Import experiments" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Create independent copies" }),
    ).toBeChecked();
    expect(
      fetchMock().mock.calls.some(([url]) => String(url).endsWith("/apply")),
    ).toBe(false);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Create copies" })),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3000/api/import-experiments/preview-1/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "copy", replaceExisting: false }),
      }),
    );
    expect(
      screen.getByText("1 experiment(s) imported as independent copies!"),
    ).toBeInTheDocument();
  });
  it("requires explicit replacement confirmation for restoring local collisions", async () => {
    fetchMock().mockImplementation(async (url: string) =>
      url.endsWith("/inspect")
        ? okJson(preview())
        : url.endsWith("/apply")
          ? okJson({ success: true, imported: 1 })
          : okJson({ experiments: [] }),
    );
    const { container } = render(<Settings />);
    await choose(container);
    fireEvent.click(screen.getByRole("radio", { name: "Restore backup" }));
    expect(screen.getByText(/Local study/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore backup" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText(
        "Replace the listed local experiments and their local results",
      ),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Restore backup" })),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      expect.stringContaining("/preview-1/apply"),
      expect.objectContaining({
        body: JSON.stringify({ mode: "restore", replaceExisting: true }),
      }),
    );
  });
  it("offers only copying for a portable package and cancels without applying", async () => {
    fetchMock().mockImplementation(async (url: string) =>
      url.endsWith("/inspect")
        ? okJson(preview("portable"))
        : okJson({ experiments: [], success: true }),
    );
    const { container } = render(<Settings />);
    await choose(container);
    expect(
      screen.queryByRole("radio", { name: "Restore backup" }),
    ).not.toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Cancel import" })),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3000/api/import-experiments/preview-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      fetchMock().mock.calls.some(([url]) => String(url).endsWith("/apply")),
    ).toBe(false);
  });
  it("keeps a failed apply preview so retry uses the same import identity", async () => {
    let calls = 0;
    fetchMock().mockImplementation(async (url: string) => {
      if (url.endsWith("/inspect")) return okJson(preview());
      if (url.endsWith("/apply")) {
        calls++;
        if (calls === 1) throw new Error("Connection interrupted");
        return okJson({ success: true, imported: 1 });
      }
      return okJson({ experiments: [] });
    });
    const { container } = render(<Settings />);
    await choose(container);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Create copies" })),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Create copies" })),
    );
    expect(
      fetchMock()
        .mock.calls.filter(([url]) => String(url).endsWith("/apply"))
        .map(([url]) => url),
    ).toEqual([
      "http://localhost:3000/api/import-experiments/preview-1/apply",
      "http://localhost:3000/api/import-experiments/preview-1/apply",
    ]);
  });
  it.each(["IMPORT_PREVIEW_STALE", "IMPORT_ROLLED_BACK"])(
    "requires another inspection after %s",
    async (code) => {
      let inspected = 0;
      fetchMock().mockImplementation(async (url: string) => {
        if (url.endsWith("/inspect"))
          return okJson({ ...preview(), importID: `preview-${++inspected}` });
        if (url.endsWith("/apply"))
          return {
            ok: false,
            status: 409,
            json: async () => ({
              success: false,
              code,
              error: "The local experiment changed. Inspect again.",
            }),
          } as Response;
        return okJson({ experiments: [], success: true });
      });
      const { container } = render(<Settings />);
      await choose(container);
      fireEvent.click(screen.getByRole("radio", { name: "Restore backup" }));
      fireEvent.click(
        screen.getByLabelText(
          "Replace the listed local experiments and their local results",
        ),
      );
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Restore backup" })),
      );
      expect(
        screen.getByRole("button", { name: "Restore backup" }),
      ).toBeDisabled();
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Inspect again" })),
      );
      expect(inspected).toBe(2);
      expect(
        screen.getByRole("radio", { name: "Create independent copies" }),
      ).toBeChecked();
    },
  );
});
