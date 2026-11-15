# Software-rendered contact preparation — verified fix

The runtime was built from `cbca4c1`. The final default-driver verifier uses the strengthened action deadlines/progress at `24547fc`; earlier completed native/fallback runs retain their frozen verifier hashes and the same eight assertion groups. All reports identify the exact offline artifact.

## Cause and correction

Repeated zero-delay timer yields queued contact geometry, terrain, body setup and replay work behind expensive software-rendered frames. The prior default configuration remained unready after its 90-second gate; a fresh diagnostic still showed preparation pending after 107 seconds. Substituting the continuation task queue isolated the starvation. [Diagnostic samples](diagnosis.json) distinguish the temporary causal probes from final acceptance. The original [failed release receipt](../evaluation/release/public-flight-software-timeout.json) is preserved.

Preparation now uses the browser’s prioritized `scheduler.yield()` when available. Older browsers use MessageChannel tasks and an eight-millisecond batching target at existing cooperative checkpoints, closing both ports on completion. Node retains timer yields. This is not preemptive real-time scheduling. [Chrome’s scheduling guidance](https://developer.chrome.com/blog/use-scheduler-yield) explains continuation priority.

No contact equations, solver steps, source geometry, collider resolution, visual resolution or numerical tolerances changed. The [source comparison](numerical-source-review.json) excludes only scheduling declarations/imports/await replacements and confirms the remaining source is equal. Contact remains 120 Hz, up to 12 seconds, with the original 157 NASA primitives and existing terrain/CCD checks.

## Completed acceptance

| Configuration | Transport | Result | Follow-to-ready (ms) |
| --- | --- | --- | --- |
| Default headless SwiftShader | web | 8/8 groups pass | 1848 |
| Default headless SwiftShader | file | 8/8 groups pass | 359 |
| SwiftShader · 4× CPU slowdown · scheduler disabled | web | 8/8 groups pass | 7371 |
| SwiftShader · 4× CPU slowdown · scheduler disabled | file | 8/8 groups pass | 4930 |
| Mac M1 Pro · Metal | web | 8/8 groups pass | 663 |
| Mac M1 Pro · Metal | file | 8/8 groups pass | 29 |

Each transport exercises introduction/branding, local Follow, play/pause/replay, nominal touchdown, underpowered contact and breakup, all 22 numeric-variable explanations/edits, visible ascent/descent, camera persistence and reload/error checks. Offline contexts disable networking and assert no HTTP requests. The final default-driver run keeps the original 90-second readiness gate and adds 30-second generic-action deadlines.

The timing starts after selecting Follow and ends at settled framing plus ready contact; preparation can begin earlier during flight loading. It is not whole-app startup or a standalone physics benchmark. Local/warm-file browser runs and CPU emulation do not qualify every physical low-end device or internet connection. Software rasterization can still paint slowly; this fix removes preparation starvation without claiming a universal frame rate.

Full project suite: **1,474 pass, zero fail/skip/cancel**. Focused contact/geometry/terrain/scheduling checks: **40 pass**, including every-state clearance and deterministic actual-NASA-part replay. Nonincremental typecheck, lint, 314 native MathML expressions and Next/web/offline builds pass. Slop scan found no new edited-file defect. Scientific publication checks remain green at 42 bounded verified findings and 22 uncertain; scheduling source/dependencies are bound, and no operational certification is implied.

The [independent Sol review](REVIEW.md) found no actionable defects and passed its 36 focused checks. Its merge condition was completion of the parent’s remaining default-driver acceptance, now recorded above.

One earlier default-driver acceptance pilot was stopped by the parent after a long uninstrumented variable-check section to add action deadlines and progress. A redundant help-only probe was also stopped. Neither interrupted run is counted as a pass. The final bounded default-driver run completed both transports; raw final reports and their verifier hashes remain alongside this document.

## Artifact and handoff

Offline: **97,806,793 bytes**, SHA-256 `5ca73925e68fae85654748189a51020db6830d2963c419785b86785040e2d76c`. The split web build is identified by `web/build-receipt.json`; obsolete chunks are pruned. No new dependency, worker payload or external offline request is introduced.

Hosting remains teammate-owned. Real-device/assistive-technology/network acceptance and the existing qualified terrain/vehicle/station evidence tasks remain in [IN-FLIGHT.md](../../IN-FLIGHT.md).
