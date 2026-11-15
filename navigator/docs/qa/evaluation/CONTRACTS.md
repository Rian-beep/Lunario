# Evaluation improvement contracts

Locked parent baseline: Rian main6b10ee8, including incoming south-pole detail. User authorizes applying reproducible evaluation findings. Maximum five Clevo gpt-6.1-sol workers, separate worktrees and ownership. All raw downloads and worktrees under /tmp; Storage has little free space. No Simulator/Metro, shared browser profile or app server. The parent owns preview servers, all shared UI wiring, version/binding changes, builds and release artifacts. Workers are not alone; do not revert others or edit outside scope.

## Ownership

| Lane | Owned source/output | Read-only shared boundaries |
|---|---|---|
| terrain | components/workbench/scene/ion/**, lib/ion/**, new components/workbench/scene/terrain-evaluation/**, tests/ion/**, tests/terrain-evaluation/**, scripts/evaluation-terrain/**, docs/qa/evaluation/terrain/** | runtime.ts, scene.tsx, incoming lunar-terrain.js/south-pole-detail.ts, global scientific terrain |
| confidence | new lib/evidence-confidence/**, components/evidence-confidence/**, tests/evidence-confidence/**, docs/qa/evaluation/confidence/** | all existing numerical/assessment modules and UI |
| comms | lib/engineering-evidence/**, lib/providers/comms.ts, lib/station-weather-context.ts, new components/comms-evaluation/**, tests/comms-evaluation/**, docs/qa/evaluation/comms/** | canonical astro/mission/assessment/scenario schemas, existing inspector wiring |
| trajectories | lib/mission-trajectories*.ts, components/mission-trajectories/selector.tsx, public/data/trajectories/**, tests/mission-trajectories.test.ts, scripts/prepare-mission-trajectories*, docs/TRAJECTORY-COVERAGE.md, docs/qa/evaluation/trajectories/** | parent-owned replay.tsx/workspace.tsx, main scene/runtime/Nav |
| audience | new scripts/evaluation-audience/**, tests/evaluation-audience/**, docs/qa/evaluation/audience/** | all production UI/source read-only; return reproducible fixes to parent |

Parent owns components/navigator.tsx, public-exploration.tsx and shared UI, scene/runtime.ts, scene.tsx, south-pole-detail.ts, lunar-terrain.js, performance scripts/new lib/performance/**, global CSS/packages, assessment/model version, manifests/bindings and generated applications. Ask parent through a handoff note for cross-boundary fixes. No credentials in any file/log/report or tokens in downloads/exports.

## Contracts and quality

- Preserve original Lunario3s loader, reference light/dark aesthetic, icons and placement, dismissible cards and map-first canvas. Add explanatory modules inside existing inspector/workspaces, not another permanent map overlay.
- evaluateScenario is the only canonical mission authority. No new pass inferred from imagery, independent RF screen, finite cases or a generic flight preview.
- Confidence: distinguish measured/calibrated errors, quantization/encoding, assumed bounds, finite sensitivity and unquantified physical uncertainty. No fabricated statistical confidence or source-precision-as-physical-error. Components accept live context/results via props; document them for parent.
- Comms: explicit Earth-centre vs station line-of-sight, local masks, supported epoch/coverage, rates/bands, booked/compatible service, weather forecast/assumption/unknown. New evidence must bind site/time/hardware and preserve stale/partial/missing states.
- Trajectories: preserve frame/time scale/units/source hashes; no extrapolation or invented telemetry/attitude/burn state. Confirmed actual/reconstructed/planned/reference/display simulation remain distinct. Qualify mapping before contact or historical-lighting claims.
- Terrain: new files from Rian are incoming evidence, not an automatic visual/physical pass. Diagnose actual paths, cancellation/disposal/LOD/colour/registration. Synthetic fixture results are not live provider acceptance. Preserve local fallback, raycast origin and one existing camera/renderer.
- Tests: add regression alongside a demonstrated fix. Run focused checks, nonincremental typecheck and lint before committing. Relevant current-source independent comparisons must be rerun for changed numerics. Do not alter reviewed evidence bindings/model IDs yourself; report exact changes and reproduction. Pending parent binding update is not a passing global publication gate.
- Audience/performance: record actual agent/browser checks, keyboard/native200%/touch emulation and contrast separately from human/screen-reader learning acceptance. Do not fabricate participants or measured latency. Compare same artifacts/inputs, report device/renderer/network, cold/warm and intentional3s loader time separately.

Every lane delivers REPORT.md and machine-readable findings.json with id, observed behavior, reproducible steps, root cause, change/test evidence, status(open/fixed/not-reproduced/needs-external-evidence), limitations and exact source commit. Use primary sources for scientific/technical research. Commit explicit paths conventionally; bundle HEAD excluding the supplied evaluation base and report owned commits, commands/counts, interface requirements and remaining evidence. No push/merge by workers.
