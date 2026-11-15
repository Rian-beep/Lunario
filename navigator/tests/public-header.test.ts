import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDIENCE_GUIDES} from '../lib/onboarding';

const navigator = readFileSync(new URL('../components/navigator.tsx', import.meta.url), 'utf8');

test('Public header keeps Moon/map essentials and hides Lander, Lab and engineering controls', () => {
  assert.match(navigator, /mode==='public'\?\(\['moon','earth'\] as const\):\(\['moon','earth','lander'\] as const\)/);
  assert.match(navigator, /mode!=='public'&&<Button variant="ghost" onClick=\{\(\)=>\{setPlaying\(false\);setFlightPlaying\(false\);setTouchdownOpen\(true\);\}\}>Lab<\/Button>/);
  assert.match(navigator, /mode!=='public'&&<Button variant="outline" aria-label="Replan mission"/);
  assert.match(navigator, /mode!=='public'&&<Button className="header-learn"/);
  assert.match(navigator, /mode==='public'&&<Button variant="outline" aria-label="Compare sites and dates"/);
  assert.match(navigator, /mode==='public'\?'Pick a site':'Sites'/);
  assert.match(navigator, /if\(id==='public'&&assetFocus==='lander'\)requestAssetFocus\('moon'\)/);
  assert.doesNotMatch(navigator, /mode==='public'&&[^>]{0,120}>\s*Lab\s*</);
});

test('Public mode guide opens with the Horizons/LOLA pitch and Pick / Move / Compare actions', () => {
  const guide = AUDIENCE_GUIDES.public;
  assert.match(guide.intro, /Lunar Landing Site Navigator, using JPL Horizons and LOLA terrain to compare sunlight and Earth view at the south pole/);
  assert.deepEqual(guide.steps.map(([title]) => title), ['Pick a site', 'Move the date', 'Compare']);
  assert.equal(guide.action, 'Pick a site');
  assert.doesNotMatch(guide.intro + guide.steps.map(([, text]) => text).join(' '), /antenna viewing limit|assessed requirements|in shadow/i);
});

test('Public overview status softens shadow and Earth-mask jargon', () => {
  assert.match(navigator, /mode==='public'\?"Sun is hidden behind the hills":"In shadow"/);
  assert.match(navigator, /mode==='public'\?"Earth is above the hills":"Earth in view"/);
  assert.match(navigator, /mode==='public'\?"Earth is hidden behind the hills":"Earth below mask"/);
});
