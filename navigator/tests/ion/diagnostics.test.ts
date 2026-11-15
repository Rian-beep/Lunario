import test from 'node:test';import assert from 'node:assert/strict';
import {ionHttpStatus,ionFailureLabel} from '../../lib/ion/diagnostics';
test('tile diagnostics expose HTTP stage and status without raw provider URLs or credentials',()=>{
 const error=new Error('private-provider.invalid/secret?token=private status 401');
 assert.equal(ionHttpStatus(error),401);
 const label=ionFailureLabel({stage:'endpoint',status:ionHttpStatus(error)});
 assert.match(label,/endpoint; HTTP 401/);assert.doesNotMatch(label,/secret|token|provider/);
 assert.equal(ionHttpStatus(new Error('status 200')),undefined);
 assert.equal(ionHttpStatus({message:'code 403'}),undefined);
 assert.equal(ionFailureLabel({stage:'renderer',status:999}),' Stage: renderer.');
});
