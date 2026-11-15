import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { StationEvidenceSummary } from '../../components/comms-evaluation/evidence-summary';
import { chain, now, stay } from './fixtures';

async function main() {
  Object.assign(globalThis, { React });
  const e = chain();
  e.requirements.critical = [{ ...stay, id: 'Synthetic command window', minimumBits: 1800000, minimumContactSeconds: 3600 }];
  const baselineHtml = await readFile('public/solarreach-navigator.html', 'utf8');
  const styles = [...baselineHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const component = renderToStaticMarkup(<StationEvidenceSummary envelope={e} scenarioKey="test-case" stay={stay} nowUtc={now}/>);
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated station evidence fixture</title><style>${styles}</style><body style="color:var(--foreground);background:var(--background)"><main id="fixture" style="margin:16px auto;width:calc(100% - 32px);max-width:800px"><p style="margin-bottom:16px">Synthetic station evidence fixture · isolated component, no operational data or app integration</p>${component}</main></body></html>`;
  await writeFile('/tmp/lunario-comms-component.html', html);
  console.log(JSON.stringify({ fixture: '/tmp/lunario-comms-component.html', styleSource: 'public/solarreach-navigator.html',
    styleSourceSha256: createHash('sha256').update(baselineHtml).digest('hex'), fixtureSha256: createHash('sha256').update(html).digest('hex') }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
