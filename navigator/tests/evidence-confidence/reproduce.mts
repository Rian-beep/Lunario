import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { catalog, manifest, provenance, scenario } from './fixtures';
import { evaluateScenario } from '../../lib/assessment';
import { evaluateDeclaredBounds, type UncertaintyEnvelope } from '../../lib/engineering-evidence/uncertainty';
import { evaluateEvidenceConfidence, exportEvidenceConfidence } from '../../lib/evidence-confidence';

const state = scenario();
state.operations.loadSegments = [{ id: 'Synthetic scheduled experiment', startOffsetHours: 0.5, endOffsetHours: 2, additionalW: 75 }];
const declaredBounds: UncertaintyEnvelope = { schema: 'solarreach-declared-bounds-1', scenarioKey: evaluateScenario(catalog, state, manifest).scenarioKey, bounds: [{ field: 'loadW', lower: 200, upper: 300, provenance }] };
const stability = await evaluateDeclaredBounds(catalog, manifest, state, declaredBounds);
const summary = evaluateEvidenceConfidence({ catalog, state, manifest, stability });
const after = JSON.parse(exportEvidenceConfidence(summary, '2026-11-15T12:00:00Z'));
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const baseModule = execFileSync('git', ['show', '3c82b5a:navigator/lib/engineering-evidence/uncertainty.ts']);
const selected = summary.selection;
console.log(JSON.stringify({
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  baseline: '3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',
  scope: 'Actual committed catalog and selected coordinates/stay; synthetic declared loads, not observations or hardware qualification',
  existingModule: { path: 'lib/engineering-evidence/uncertainty.ts', baseSha256: hash(baseModule), currentSha256: hash(readFileSync('lib/engineering-evidence/uncertainty.ts')), identicalToBase: hash(baseModule) === hash(readFileSync('lib/engineering-evidence/uncertainty.ts')) },
  before: { exportedKeys: Object.keys(stability), hasFullNominalScenario: 'heldScenario' in stability, hasDatasetId: 'datasetId' in stability, hasExplicitModelVersion: 'modelVersion' in stability, interpretation: stability.interpretation },
  after: { schema: after.schema, scenarioKey: after.scenarioKey, datasetId: after.datasetId, modelVersion: after.modelVersion, selected, fullNominalScenarioRetained: JSON.stringify(after.heldScenario) === JSON.stringify(summary.heldScenario), replayKey: evaluateScenario(catalog, after.heldScenario, manifest).scenarioKey, calibratedPhysicalUncertainty: after.calibratedPhysicalUncertainty, physicalOutcomeInterval: after.physicalOutcomeInterval, finiteCases: after.finite.result.cases.length, finiteStatus: after.finite.status, scenarioByteCount: Buffer.byteLength(JSON.stringify(after.heldScenario)), exportByteCount: Buffer.byteLength(JSON.stringify(after)) },
  limitations: ['New export is useful only once parent wires it into the existing workspace', 'Manifest declarations are retained, not authenticated or rehashed', 'No raw catalog is embedded; same catalog/model is needed to replay', 'Existing finite-case export remains unchanged', 'No physical calibration, probability or operational acceptance inferred'],
}, null, 2));
