# ADR 0006: One assessment for every mission comparison

Accepted: 14 November 2026.

## Decision

A versioned scenario carries independent subsystem heights, requirements and operations. `resolveAnalysisContext` establishes coordinates, coverage and prepared horizons; `evaluateMission` remains the only power/storage calculator; `evaluateScenario` assembles constraints, events, evidence and warnings. Calendar search, contingency matrices, saved comparisons, sensitivity, teaching and decision exports consume that same authority.

Requirements have pass/fail/conditional/not-assessed states. The overall result gives known required failures precedence, then missing evidence, then conditional evidence. Source uncertainty is not replaced by a score. Timed model events and untimed aggregate failures remain distinct.

## Consequences

Changing the model meaning increments the version (currently planning-3). Exports retain exact inputs and evidence; imports validate and recompute against installed data. Old input-only shares migrate to schema 2 without changing requested dates. Unsupported coverage is rejected, not silently shortened.

External reports bind to a physical evidence-scope identity that excludes the report array; assessment identity includes reports. This prevents a report from invalidating itself while changes to site, date, hardware, operations or requirements still invalidate its scope. SHA256 is reserved for asset integrity; deterministic scenario keys are cache/comparison identity, not digital signatures.

The UI retains one comparison workspace with contingency, mission-calendar and saved-scenario views. Controlled comparisons select their actual baseline and preserve unrelated saved entries. Historical landing records remain useful map context but cannot pass terrain-based resource assessment without prepared horizons.

## Validation

Analytic electrical fixtures, independent instrument heights, evidence loss, endpoint coverage, key stability, report staleness, full-stay search, CSV/JSON roundtrips and browser workflows exercise the decision boundary. Independent high-resolution terrain/frame validation and actual screen-reader checks are reported separately, never inferred from unit tests.
