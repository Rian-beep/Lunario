import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {Site} from '../lib/catalog';
import {LANDING_SITES} from '../lib/landing-sites';
import {DSN_STATIONS} from '../lib/dsn';
import {nearbyMissionPins,publicLunarContact,publicRadioWeather,publicStationRole,siteHistoryLabel} from '../lib/public-exploration';
import {PublicSiteStory,PublicStationStory} from '../components/workbench/public-exploration';
Object.assign(globalThis,{React});
function mission(id:string):Site{const r=LANDING_SITES.find(s=>s.id===id)!;assert.ok(r);return{...r,group:'robotic',demHeightM:null,slopeDeg:null,source:r.program,horizons:[],mission:{...r}};}
test('public history distinguishes Apollo, candidates, attempted targets and custom coordinates',()=>{
 const apollo=mission('apollo-11');assert.match(siteHistoryLabel(apollo),/Apollo.*1969-07-20.*Landed/);
 assert.match(siteHistoryLabel({...apollo,mission:undefined,group:'artemis'}),/Candidate.*no past landing/);
 assert.match(siteHistoryLabel({...apollo,mission:{...apollo.mission!,coordinateKind:'planned-target',outcome:'attempt'}}),/touchdown not confirmed/);
 assert.match(siteHistoryLabel(null),/no landing asserted/);
});
test('Apollo 12 shows the separate Surveyor 3 pin nearby without relocating or conflating missions',()=>{
 const a=mission('apollo-12'),s=mission('surveyor-3');const sites=[a,s,mission('apollo-11')];
 const result=nearbyMissionPins(sites,a.lat,a.lon,a.id,1737400);
 assert.deepEqual(result.map(s=>s.site.id),['surveyor-3']);assert.ok(result[0].distanceKm>0&&result[0].distanceKm<1);
 assert.deepEqual(nearbyMissionPins([{...s,mission:{...s.mission!,approximate:true}}],a.lat,a.lon,a.id,1737400),[]);
 assert.deepEqual(nearbyMissionPins(sites,NaN,a.lon,null,1737400),[]);
 const html=renderToStaticMarkup(createElement(PublicSiteStory,{site:a,sites,lat:a.lat,lon:a.lon,radiusM:1737400}));
 assert.match(html,/Surveyor 3/);assert.match(html,/not mean the same landing point/);assert.match(html,/timeline still evaluates your selected/);
});
test('all three Earth complexes have a purpose/location and do not assert a station pass from lunar visibility',()=>{
 for(const station of DSN_STATIONS){const text=publicStationRole(station);assert.ok(text.includes(station.country));assert.ok(text.includes(station.antenna));assert.match(text,/Earth ground complex/);
  const html=renderToStaticMarkup(createElement(PublicStationStory,{station,contact:true}));assert.match(html,/does not establish their current Moon visibility/);assert.match(html,/does not automatically add their signal strengths/);assert.match(html,/Link margin/);
 }
 assert.match(publicLunarContact(false),/does not remove.*lunar obstruction/);assert.match(publicLunarContact(null),/unavailable/);
});
test('weather explains rain, cloud and wind without manufacturing a signal strength or substituting unknown rain',()=>{
 const base={epochMs:0,temperatureC:12,windKmh:10,precipitationMm:1,cloudPercent:100};
 assert.match(publicRadioWeather(base),/Rain is forecast.*Ka-band/);
 assert.match(publicRadioWeather({...base,precipitationMm:null}),/Rain information is unavailable/);
 assert.match(publicRadioWeather({...base,precipitationMm:0}),/No rain is forecast.*does not establish/);
 assert.equal(publicRadioWeather({...base,cloudPercent:0}),publicRadioWeather(base),'Cloud cover is not converted to a radio-strength score');
 assert.match(publicRadioWeather(base),/do not calculate attenuation, link margin or an outage/);
});
