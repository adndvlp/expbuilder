# DynamicPlugin response timing matrix

`ParticipantResponseSignal` is the common response contract. When a browser
event is observable, the component captures `event.timeStamp` immediately and
the same signal is passed through the shared hub, pending component recording,
trial `response_time`, RT anchors and component data. A fallback is never
reported as equivalent to an observed keyboard/pointer event.

| Component | Physical event / confirmation | Observable event | Timestamp authority | Component RT and trial `response_time` | `response_allowed_from` | Early precision transition |
|---|---|---:|---|---|---|---|
| KeyboardResponse | `keydown` | Yes | `event.timeStamp`; validated fallback only | Same signal for component and trial | Direct shared-hub gate | Yes; listener is armed before commit |
| Click/pointer | `pointerdown`; `click` only for PointerEvent compatibility | Yes | `event.timeStamp`; validated fallback only | Same signal for component and trial | Direct shared-hub gate | Yes only for full-surface, marker-free fast path |
| ButtonResponse | `pointerdown` or accessibility `click` | Yes | `event.timeStamp`; validated fallback only | Same signal for component and trial | Direct shared-hub/external-event gate | No current early-safe declaration |
| InputResponse | Submit/confirm event owned by the terminating component | Yes at submit owner | Inherited `ParticipantResponseSignal` | `recordAllPendingResponses(signal)` uses submit timestamp; never samples again | Gate runs once at submit owner | No |
| SliderResponse | Submit/confirm event; existing submit RT semantics retained | Yes at submit owner | Inherited `ParticipantResponseSignal` | Uses submit timestamp, not first/last slider movement | Gate runs once at submit owner | No |
| FileUpload | Native file-input `change` | Yes | `event.timeStamp` captured before validation/read/upload | Scientific RT ends at selection; upload start/completion/duration are separate | Direct external-event gate, finish deferred for upload | No |
| Survey | Completion `click`/`submit`; capture phase used when safe | Usually | Observed `event.timeStamp`; otherwise explicit `performance.now_fallback` quality | Original completion signal survives library/async completion | Direct external-event gate when observable | No |
| Text cloze | Submit/confirm event owned by terminating component | Yes at submit owner | Inherited `ParticipantResponseSignal` | Pending cloze data uses the submit timestamp | Gate runs once at submit owner | No |
| Sketchpad | Stroke `pointerdown` and terminal pointer event | Yes | Each stored stroke event uses `event.timeStamp` | Stroke timing is event-based; trial termination remains parent-controlled | Parent termination gate | No |
| AudioResponse done button | Done `click` | Yes | Done-button `event.timeStamp` | RT ends at click; async stop/processing cannot move it | Direct external-event gate | No; no media-clock changes in this iteration |

For every direct gate, comparisons against `trial_onset`, scheduled stimulus
onset or `stimulus_commit` use `signal.timestamp`, never handler execution time.
Keyboard and precision pointer handlers perform zero layout reads and zero DOM
queries on their critical path; duration/layout/query telemetry is recorded per
response event type.
