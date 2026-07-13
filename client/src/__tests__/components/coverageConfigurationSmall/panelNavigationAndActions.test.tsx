import {
  ExperimentPanel,
  TrialActions,
  asyncMocks,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  useNavigate,
  useParams,
  vi,
} from "./testHarness";

describe("coverage configuration: experiment panel", () => {
  it("does not load an experiment name when the route has no id", () => {
    vi.mocked(useParams).mockReturnValueOnce({});

    render(<ExperimentPanel />);

    expect(asyncMocks.fetchExperimentNameByID).not.toHaveBeenCalled();
  });

  it("loads experiment name and switches result/settings tabs", async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);

    render(<ExperimentPanel />);

    expect(screen.getByText("Experiment Panel")).toBeInTheDocument();
    await screen.findByText("Loaded Experiment");
    expect(screen.getByTestId("results-list")).toHaveTextContent("local");

    fireEvent.click(screen.getByText("Go to Home"));
    expect(navigate).toHaveBeenCalledWith("/home");

    fireEvent.click(screen.getByText("Go to Builder"));
    expect(navigate).toHaveBeenCalledWith(
      "/home/experiment/test-exp-123/builder",
    );

    fireEvent.click(screen.getByText("Preview Results"));
    expect(screen.getByTestId("results-list")).toHaveTextContent("preview");

    fireEvent.click(screen.getByText("Local Experiments"));
    expect(screen.getByTestId("results-list")).toHaveTextContent("local");

    fireEvent.click(screen.getByText("Online Experiments"));
    expect(screen.getByTestId("results-list")).toHaveTextContent("online");

    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByTestId("experiment-settings")).toHaveTextContent(
      "test-exp-123",
    );
  });
});

describe("coverage configuration: trial actions", () => {
  it("renders trial and loop save states and delegates actions", () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <TrialActions onSave={onSave} canSave={false} onDelete={onDelete} />,
    );

    expect(screen.getByRole("button", { name: "Save trial" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    rerender(
      <TrialActions onSave={onSave} canSave onDelete={onDelete} isLoop />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Loop" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
