# Generated experiment runtime tests

This suite verifies the full contract from experiment authoring to execution of
the generated HTML. Playwright is used only to run the participant-facing
artifact; it does not click through the Builder UI.

## Test boundary

Each scenario must follow the same path as the application:

1. `ScenarioAuthor` creates the experiment, trials, loops, branches and
   configuration through the same headless intent commands imported by the
   React components. The HTTP client is only the persistence adapter.
2. `compileLocalExperiment` invokes the production code generator without
   requiring React state.
3. The server builds and serves the real HTML artifact through its stable
   experiment-ID route.
4. Chromium executes jsPsych and the real plugin assets.
5. `RuntimeObserver` verifies the rendered route, runtime events and persisted
   session rows, and fails on page exceptions, console errors, failed requests
   or errors reported by the generated runtime guard.

Scenarios must not write database fixtures directly, reproduce Canvas logic in
test code, or assemble substitute HTML. If authoring requires a new Builder
operation, expose the production action through `ScenarioAuthor`.

React and the runtime suite share the reducers/save commands for branch and
repeat conditions, params override, conditional loops and loop-level branch
selection. Trial/loop creation, root branching and moves likewise use the
Canvas actions invoked by React. `ScenarioAuthoringSession` mirrors the UI read
model: it starts with an empty graph and adopts the canonical graph returned by
every server mutation.

## Commands

From `client/`:

```sh
npm run test:runtime
npm run test:runtime:headed
npm run test:runtime:debug
```

A file or Playwright filter can be forwarded to the runner:

```sh
npm run test:runtime -- runtime-e2e/scenarios/navigation-runtime.spec.ts
npm run test:runtime -- -g "authors a jump"
```

The runner allocates a free local port and an isolated temporary database. The
suite uses one worker so scenarios never share authoring or session state.

## Current vertical coverage

- conditional and default branching;
- branches exiting non-terminal, root and nested-loop levels;
- params override and conditional loops;
- Canvas move semantics followed by generated execution;
- jump-to-trial with a durable reload boundary;
- resume into the route selected by the last persisted response;
- DynamicPlugin asset loading and response persistence;
- composed nested-loop exit, condition and params-override behavior;
- participant error screen plus machine-readable runtime failure capture.

## Adding a scenario

Create the entire graph with `ScenarioAuthor`, compile it, and navigate to the
returned `experimentUrl`. Assert both observable participant behavior and the
persisted session sequence. Call `runtime.assertNoRuntimeFailures()` after the
success path. When a failure is intentional, assert the error overlay and the
runtime snapshot instead.

Runtime traces, screenshots and videos are written to
`runtime-e2e/artifacts/`; the HTML report is written to `runtime-report/`.
