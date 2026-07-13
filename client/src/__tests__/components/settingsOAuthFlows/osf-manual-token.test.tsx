import {
  docSnap,
  fillOsfManualForm,
  mocks,
  okJson,
  registerSettingsOAuthTokensHooks,
} from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OsfToken from "../../../pages/Settings/OsfToken";

describe("Settings OAuth tokens", () => {
  registerSettingsOAuthTokensHooks();

  it("shows OSF manual token save failures and clears the manual form on cancel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ success: false, message: "Token rejected" }),
    );

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByText("Use Personal Access Token instead"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(
      screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"),
      {
        target: { value: "abc12" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Token rejected")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByPlaceholderText("Paste your OSF token here"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Use Personal Access Token instead"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    expect(
      screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"),
    ).toHaveValue("");
    expect(
      screen.getByPlaceholderText("Paste your OSF token here"),
    ).toHaveValue("");
  });

  it("surfaces OSF manual save exceptions", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByText("Use Personal Access Token instead"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(
      screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"),
      {
        target: { value: "abc12" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
      target: { value: "osf-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("network down")).toHaveLength(2);
    expect(console.error).toHaveBeenCalledWith(
      "Error saving OSF token:",
      expect.any(Error),
    );
  });

  it("uses OSF manual-save defaults for sparse responses and thrown values", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: false }));
    const failureView = render(<OsfToken />);
    await fillOsfManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Failed to save token")).toHaveLength(2);
    failureView.unmount();

    mocks.getDoc.mockResolvedValue(docSnap({}));
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: true }));
    const successView = render(<OsfToken />);
    await fillOsfManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findByText(/Connected/)).toBeInTheDocument();
    successView.unmount();

    mocks.getDoc.mockResolvedValue(docSnap({}));
    vi.mocked(fetch).mockRejectedValueOnce("offline");
    render(<OsfToken />);
    await fillOsfManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Error saving token")).toHaveLength(2);
  });

  it("saves a manual OSF token through osfManage and updates connected state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ success: true, userName: "OSF User" }),
    );

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByText("Use Personal Access Token instead"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
      target: { value: "osf-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(
      await screen.findAllByText("Please enter a valid OSF Project ID"),
    ).toHaveLength(2);

    fireEvent.change(
      screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"),
      {
        target: { value: "abc12" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "saveToken",
            uid: "user-123",
            token: "osf-token",
            projectId: "abc12",
          }),
        }),
      );
    });
    expect(await screen.findByText(/Connected/)).toBeInTheDocument();
    expect(window.alert).toHaveBeenCalledWith("OSF token saved successfully!");
  });
});
