# Native timeline navigation

Every navigation connection goes from a trial to a trial. A destination may precede its source, be shared by several routes, or belong to a different loop. Loops are containers; they are not navigation sources or destinations.

Each trial stores `branches`, a flat ordered `branchConditions` list, and `defaultNextTrialId`. The first matching condition selects its `nextTrialId` and optional `customParameters`. If none matches, the explicit default is used. A null default closes the current route; `FINISH_EXPERIMENT` ends the experiment. Configured condition and default destinations must have visible edges. Their creation dates and positions in arrays do not choose the route.

```json
{
  "branches": [10, 20],
  "branchConditions": [{
    "id": 1,
    "rules": [{ "column": "response", "op": "==", "value": "yes" }],
    "nextTrialId": 20,
    "customParameters": { "stimulus": { "source": "typed", "value": "Selected" } }
  }],
  "defaultNextTrialId": 10
}
```

Every root or loop scope has an explicit `entryItemId`. A loop additionally stores its structural `nextItemId`, used when its native procedure completes. Sequential authoring operations edit these connections explicitly. Reordering stored definitions alone does not add navigation.

Entering a destination follows its own outgoing connections. Sharing that destination does not make unrelated later trials execute. Selecting a previous or current trial creates a fresh execution in the future of the active jsPsych timeline.

Within an active loop, a same-scope transition retains its CSV row and repetition. A conditional exit closes the abandoned descendant timelines immediately. An ordinary default exit is deferred until the containing loop completes its rows, repetitions and conditional cycles. Closing a route inside a loop completes its row and allows native iteration to continue.

Loop `repetitions`, `loopConditions`, `isConditionalLoop`, CSV sampling, orders, categories and custom lifecycle callbacks retain their roles. Navigation conditions belong to trials.

All destinations support one-time parameter overrides and the same persistence barrier. The source callback returns, its result is saved once, and execution continues after durable acknowledgement. Navigation does not reload the document. Resume restores the version 3 cursor, loop sampling state, future entries and pending destination parameters without reevaluating the completed source.

Imports and artifact generation require the current contract. Invalid navigation is rejected before changing experiment data or restoring media. There is no conversion of old navigation records or checkpoints.
