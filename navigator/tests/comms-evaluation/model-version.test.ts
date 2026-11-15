import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMUNICATIONS_MODEL_VERSION, evaluateCommunications } from '../../lib/engineering-evidence/communications';
import { emptyEnvelope } from '../../lib/engineering-evidence/workspace';
test('station screening exports its acceptance-policy version without conferring mission approval', () => {
 const result = evaluateCommunications(emptyEnvelope('selection'), 'selection', {startUtc:'2026-11-14T00:00:00Z',endUtc:'2026-11-14T01:00:00Z'}, '2026-11-15T00:00:00Z');
 assert.equal(result.modelVersion, COMMUNICATIONS_MODEL_VERSION);
 assert.equal(result.status, 'incomplete');
 assert.equal(result.operationalApproval, false);
});
