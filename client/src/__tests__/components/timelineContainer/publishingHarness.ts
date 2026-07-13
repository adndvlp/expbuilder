import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

export function enableAuthenticatedPublishing(mocks: any) {
  mocks.authUser = { uid: "user-123" };
  mocks.auth.currentUser = { uid: "user-123" };
  mocks.firestoreData = {
    googleDriveTokens: { access_token: "drive" },
    githubTokens: { access_token: "github" },
  };
}

export async function confirmGitHubPagesPublish() {
  await waitFor(() => {
    expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
  });
  fireEvent.click(screen.getByText("Publish to GitHub Pages"));
  fireEvent.click(await screen.findByText("Confirm"));
}

export async function copyPublishedPagesLink() {
  expect(
    await screen.findByText("Published to GitHub Pages"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Copy GitHub Pages Link"));

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    "https://pages.test/exp-123",
  );
  expect(
    await screen.findByText("GitHub Pages link copied!"),
  ).toBeInTheDocument();
}
