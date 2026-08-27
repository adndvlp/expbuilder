# DynamicPlugin timing and preparation architecture

This document describes the joint Iteration 8 architecture formed by the
DynamicPlugin snapshot and the ExpBuilder jsPsych snapshot.

## One timing authority

`FrameEngine` in the ExpBuilder jsPsych core is the only frame scheduler.
`Trial.run()` creates an administrative `TrialTimingContext` for every
DynamicPlugin trial and supplies it before calling `DynamicPlugin.trial()`.
DynamicPlugin fails immediately with a diagnostic error if that context or its
owning `FrameEngine` is missing.

`PrecisionTiming` is an adapter over that context. It does not own an animation
frame loop, a start epoch, a scheduled-frame queue, or a post-critical timer.
Visual scheduling, response timing, audio deadlines, and trial boundaries all
therefore share the core `FrameClock`.

Timing authority and early continuity are independent:

- Every supported DynamicPlugin configuration uses the global engine.
- Only statically eligible trials may preactivate their successor.
- DOM-driven HTML, cloze, video, Sketchpad, visual-button, audio-controls, and
  similar trials receive a non-continuous context with early activation
  disabled.
- Image/Text with a shared input hub, and no trial-specific live DOM, may use
  early atomic continuity after their resources are fully prepared.

The core remains the owner of frame selection, boundary replacement,
transactions, phase accounting, input authority, callback barriers, deferred
finalization, and audio re-arm.

## Preparation pipeline

Preparation has three explicit stages:

```text
RESOURCE / MAIN / GPU PREPARATION (SAFE-only)
  -> READY DESCRIPTOR PUBLICATION (bounded and response-safe)
  -> RUNTIME CONTEXT MATERIALIZATION (response-safe only by contract)
```

The coordinator never infers that work is response-safe. A plugin must publish
a `PreparedTrialDescriptor` whose contract states:

```ts
{
  materializationSafe: true,
  estimatedCostMs: number,
  resourceReady: true,
  gpuReady: true,
  requiresLiveDom: false
}
```

Resource preparation is queued with `responseSafe: false`. Descriptor
publication may run during a response-sensitive interval only when the reusable
resource template explicitly declares bounded publication safe. Runtime
materialization may run there only when every descriptor predicate above is
true. A cold or insufficient resource horizon is reported explicitly as
`resource_horizon_insufficient`; it is never recorded as a clean precision
transition.

## Persistent visual surface

The WebGL surface belongs to the experiment run, not to an individual trial.
For prepared Image/Text trials with Keyboard, markerless Click, or no-controls
Audio, runtime materialization uses a detached execution descriptor and the
persistent surface directly. It must not create, append, remove, resize, style,
or measure a trial-specific DOM container.

Components that genuinely require live DOM receive a container. Such a trial
does not advertise response-safe runtime materialization unless it implements a
separate proven contract.

The runtime audit records:

- `runtime_materialization_dom_mutations`
- `runtime_materialization_layout_reads`
- `runtime_materialization_gpu_calls`
- `runtime_materialization_cpu_ms`

The prepared Image/Text fast path requires the first three values to be zero.

## Image resources

Image readiness distinguishes decoded CPU resources from resident GPU
resources:

- `resourceReady` means a decoded bitmap is available.
- `gpuResourceReady` means the texture key is resident in this persistent
  `CanvasStage`.

`CanvasStage.isTextureResident(textureKey)` is the source of GPU residency
truth. A bitmap-hot but texture-cold image remains in GPU preparation and its
texture upload is SAFE-only. Materialization-only execution may register a
lightweight hidden sprite referencing an existing texture; it may not call
`createTexture` or `texImage2D`.

## Text resources

Text layout, measurement, canvas allocation, rasterization, and texture upload
all happen before descriptor publication. Prepared text is cached by a
deterministic visual signature that includes the content, typography, line
layout, alignment, dimensions, device-pixel ratio, color, and other
render-affecting values.

Runtime materialization only registers a hidden sprite referencing the resident
texture. It performs no `measureText`, `fillText`, canvas creation, or GPU
upload. This contract is the same for long or multiline text and for high DPR.

## Audio resources

No-controls precision audio uses a prepared decoded `AudioBuffer` directly.
Resource preparation performs fetch and decode; runtime materialization only
retains the buffer reference. A source is created and scheduled during `arm()`.
It does not request a jsPsych `AudioPlayer` or create an HTML audio element.

When a response replaces a boundary, the existing source is cancelled and the
audio component is re-armed against the newly selected visual frame prediction.
The ideal deadline and predicted selected-frame time remain separate telemetry.
`show_controls: true` uses the DOM path and is not eligible for this bounded
materialization contract.

## Response timing

Prepared trials use one shared response hub. It is armed during preparation and
changes input authority at the visual commit. Keyboard and pointer timestamps
are validated and normalized against the shared trial onset. Platform
compatibility for missing `PointerEvent` support and invalid DOM event
timestamps does not create a second timing scheduler.

## Deferred work and simulated occupancy

Critical logical finalization is kept bounded. Heavy result construction and
resource retirement run through the existing deferred-finalization queue after
the critical interval.

The end-to-end simulator uses a `VirtualMainThreadClock`. Costs attributed to
Phase A, Phase R, Phase B, resource preparation, runtime materialization, and
global callbacks advance one `busyUntil` value. Display refresh opportunities
at or before that value do not produce a callback; the next observed frame
preserves the physical display phase. This makes a simulated dropped frame a
causal consequence of task occupancy.

## Telemetry

The runtime distinguishes cumulative and live resource metrics:

- `cumulative_retired_resources` is monotonic.
- `live_runtime_component_instances`, `live_runtime_lifecycles`, and
  `live_drawables` are current gauges.
- `pending_finalization_entries` reports outstanding deferred work.

Persistent-surface trials report `persistent_visual_boundary` and
`persistent_visual_boundary_lead_ms`. There is no replayed or consumed
cross-trial frame timestamp.

## Verification boundaries

Automated tests use real Image/Text/Audio components plus an instrumented WebGL
stage. They count texture creation/upload/deletion, text measurement and
rasterization, DOM mutations, and layout reads. Separate fast state-machine
stress tests exercise long scheduler sequences.

Browser tests cannot prove physical pixel onset, scanout behavior, device input
polling, audio output latency, OS scheduling, or hardware/driver behavior.
Final timing acceptance still requires external measurement equipment such as a
photodiode and an instrumented response device.
