import {
  componentCases,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

describe("TrialDesigner visual components", () => {
  it.each(componentCases)(
    "renders and handles Konva events for $name",
    ({ Component, props }) => {
      const onSelect = vi.fn();
      const onChange = vi.fn();
      const onGuidesChange = vi.fn();
      const rendered = render(
        <Component
          {...(props as any)}
          isSelected
          onSelect={onSelect}
          onChange={onChange}
          onGuidesChange={onGuidesChange}
        />,
      );

      for (const label of [
        "Group click",
        "Group tap",
        "Group double",
        "Group drag move",
        "Group drag end",
        "Group transform",
        "Group transform end",
        "Image click",
        "Image tap",
        "Image drag move",
        "Image drag end",
        "Image transform end",
        "Rect click",
        "Rect drag move",
        "Rect drag end",
        "Rect transform",
        "Rect transform end",
        "Transformer bound small",
        "Transformer bound short",
        "Transformer bound large",
      ]) {
        for (const button of screen.queryAllByText(label)) {
          fireEvent.click(button);
        }
      }

      expect(rendered.container.firstChild).toBeTruthy();
      expect(
        onSelect.mock.calls.length + onChange.mock.calls.length,
      ).toBeGreaterThan(0);
    },
  );
});
