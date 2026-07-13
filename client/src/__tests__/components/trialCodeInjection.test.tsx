import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrialCodeInjection from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCodeInjection";

vi.mock(
  "../../pages/ExperimentBuilder/components/CodeEditorModal",
  () => ({
    default: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
      isOpen ? <div role="dialog">{title}</div> : null,
  }),
);

describe("TrialCodeInjection", () => {
  it("renders nothing without configured tabs", () => {
    const { container } = render(
      <TrialCodeInjection tabs={undefined as any} onSave={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the code button when tabs are configured", () => {
    render(
      <TrialCodeInjection
        tabs={[
          {
            key: "on_start",
            label: "on_start",
            hint: "Runs before the trial",
            fieldKey: "customOnStart",
            customValue: "",
            computePreview: (code) => code,
          },
        ]}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Code Component" })).toBeInTheDocument();
  });
});
