import {
  TrialsConfig, act, afterEach, beforeEach, describe, expect, fireEvent,
  installTrialsContext, it, makeTrial, render, screen, vi,
} from './testHarness';
import type { Loop } from '../../../pages/ExperimentBuilder/components/ConfigurationPanel/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const panel = <TrialsConfig pluginName="plugin-html-keyboard-response" />;
const loop = (id: string): Loop => ({ id, name: id, csvColumns: [id], csvJson: [] } as Loop);

describe('TrialsConfig asynchronous cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    installTrialsContext(makeTrial());
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cancels the loading delay when the panel unmounts', async () => {
    const { unmount } = render(panel);
    await act(async () => {});
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not create a loading timer when the CSV request finishes after unmount', async () => {
    const pending = deferred<Loop | null>();
    installTrialsContext(makeTrial({ parentLoopId: 'A' }), { getLoop: vi.fn(() => pending.promise) });
    const { unmount } = render(panel);
    unmount();
    await act(async () => { pending.resolve(loop('A')); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores stale CSV results after selecting another trial', async () => {
    const first = deferred<Loop | null>(), second = deferred<Loop | null>();
    const getLoop = vi.fn(id => id === 'A' ? first.promise : second.promise);
    installTrialsContext(makeTrial({ parentLoopId: 'A' }), { getLoop });
    const { rerender, unmount } = render(panel);
    installTrialsContext(makeTrial({ id: 20, parentLoopId: 'B' }), { getLoop });
    rerender(<TrialsConfig pluginName="plugin-html-keyboard-response" />);
    await act(async () => { second.resolve(loop('B')); });
    expect(screen.getByTestId('mapper-cols')).toHaveTextContent('B');
    await act(async () => { first.resolve(loop('A')); });
    expect(screen.getByTestId('mapper-cols')).toHaveTextContent('B');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the save indicator delay on unmount', async () => {
    const { unmount } = render(panel);
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(screen.getByRole('button', { name: 'Save Custom Code' }));
    await act(async () => {});
    expect(screen.getByText(/Saved \(customOnFinish\)/)).toHaveStyle({ opacity: '1' });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not create an indicator timer when a save finishes after unmount', async () => {
    const pending = deferred<boolean>();
    installTrialsContext(makeTrial(), { updateTrialField: vi.fn(() => pending.promise) });
    const { unmount } = render(panel);
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(screen.getByRole('button', { name: 'Save Custom Code' }));
    unmount();
    await act(async () => { pending.resolve(true); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the indicator visible for the latest save when saves overlap', async () => {
    const { unmount } = render(panel);
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(screen.getByRole('button', { name: 'Save Custom Code' }));
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.click(screen.getByRole('button', { name: 'Save Extensions' }));
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText(/Saved \(parameters\)/)).toHaveStyle({ opacity: '1' });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText(/Saved Trial/)).toHaveStyle({ opacity: '0' });
    unmount();
  });
});
