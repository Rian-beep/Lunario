import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React,{createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {decodeCatalog} from '../../lib/catalog';
import {withLandingSites} from '../../lib/landing-catalog';
import {LANDING_SITES} from '../../lib/landing-sites';
import {missionHistoryForSite} from '../../lib/mission-history';
import {PublicSiteStory} from '../../components/workbench/public-exploration';
Object.assign(globalThis,{React});
const catalog=withLandingSites(decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),LANDING_SITES);
test('all selectable historical sites including legacy LCROSS have specific history directly in Location, in every audience mode',()=>{
 const sites=catalog.sites.filter(site=>site.mission||missionHistoryForSite(site.id));assert.equal(sites.length,41);
 for(const site of sites)for(const mode of ['public','teach','plan'] as const){
  const record=missionHistoryForSite(site.id);assert.ok(record,site.id);
  const html=renderToStaticMarkup(createElement(PublicSiteStory,{site,sites:catalog.sites,lat:site.lat,lon:site.lon,radiusM:catalog.meta.moonRadiusM,mode}));
  assert.ok(html.includes(' · History'),`${site.id}: ${mode}`);assert.ok(html.indexOf('<h3')<html.indexOf('<details'),`${site.id} summary is not hidden behind a closed outer disclosure`);
  assert.ok(html.includes('Touchdown outcome'));assert.ok(html.includes('Science accomplished'));
  if(mode==='teach')assert.ok(html.includes('Investigate the evidence'));
  if(mode==='plan')assert.ok(html.includes('Historical evidence limits'));
 }
});
test('custom and candidate Location contexts never acquire historical landing assertions',()=>{
 for(const site of [null,...catalog.sites.filter(site=>!site.mission&&!missionHistoryForSite(site.id))]){
  const html=renderToStaticMarkup(createElement(PublicSiteStory,{site,sites:catalog.sites,lat:site?.lat??0,lon:site?.lon??0,radiusM:catalog.meta.moonRadiusM}));
  assert.ok(!html.includes(' · History'));
  if(!site)assert.ok(html.includes('No historical landing is asserted'));
 }
});
