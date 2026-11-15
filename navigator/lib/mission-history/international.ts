import type { MissionHistoryRecord, MissionSource, Sourced } from './types';

// Reviewed 2026-11-15. Historical evidence only; no coordinates or assessment inputs.
const unknown = <T>(note: string): Sourced<T> => ({ value: null, sourceIds: [], note });
const cited = <T>(value: T, ...sourceIds: string[]): Sourced<T> => ({ value, sourceIds });
const source = (id: string, title: string, url: string, publisher: string, country: string, language: string, translationNote: string): MissionSource =>
  ({ id, title, url, publisher, country, language, translationNote });
const russian = 'English paraphrase of the Russian original; names transliterated. This is not an official translation.';
const chinese = 'English paraphrase of the Chinese original; mission names romanized. This is not an official translation.';
const japanese = 'English paraphrase of the Japanese original; this is not an official translation.';
const english = 'Agency/operator-authored English page; no translation claimed.';
const lav = (n: number) => source(`lav-${n}`, `Луна-${n} — spacecraft history`, `https://www.laspace.ru/ru/activities/projects/luna-${n}/`, 'NPO Lavochkin', 'Russia', 'Russian', russian);
const sovietDates = source('nasa-artifacts', 'Lunar artifacts — surface-event dates and identification caveats', 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html', 'NASA NSSDCA', 'United States', 'English', english);
const sovietProgramme = source('nasa-missions', 'Moon missions — USSR mission type and outcome', 'https://science.nasa.gov/moon/missions/', 'NASA', 'United States', 'English', english);
const lavChronology = source('lav-chronology', 'Основные вехи отечественной лунной программы — Новатор, August 2023, PDF p. 7', 'https://www.laspace.ru/upload/upload/novator/%E2%84%968_23.pdf#page=7', 'NPO Lavochkin', 'Russia', 'Russian', russian);
const ikiPanoramas = source('iki-panoramas', 'Трехмерные модели поверхности Луны по панорамам АМС «Луна-9» и «Луна-13»', 'https://iki.cosmos.ru/en/node/1363', 'IKI, Russian Academy of Sciences', 'Russia', 'Russian', `${russian} The /en/ URL has Russian article text. Its Luna 13 launch-date typo is not used.`);
const cnsa = (id: string, title: string, path: string) => source(id, title, `https://www.cnsa.gov.cn/${path}`, 'China National Space Administration (CNSA)', 'China', 'Chinese', chinese);
const ce3 = cnsa('cnsa-3', '嫦娥三号探测器第四月昼成功唤醒 — 14 March 2014', 'n6758823/n6758838/c6770649/content.html');
const ce3Context = cnsa('cnsa-3-context', '嫦娥三号着陆器“自述”月面生活一周年 — 15 December 2014', 'n6758823/n6758838/c6770486/content.html');
const ce4 = cnsa('cnsa-4', '嫦娥四号任务圆满成功 — 11 January 2019', 'n6758823/n6758838/c6805166/content.html');
const ce4Science = cnsa('cnsa-4-science', '嫦娥四号任务科学成果交流会在京举行 — November 2019', 'n6758823/n6758838/c6808289/content.html');
const ce5 = cnsa('cnsa-5', '嫦娥五号探测器圆满完成我国首次地外天体采样返回任务 — 17 December 2020', 'n6758823/n6758838/c6810872/content.html');
const ce6 = cnsa('cnsa-6', '嫦娥六号任务圆满成功实现世界首次月球背面采样返回 — 25 June 2024', 'n6758823/n6758844/n10518102/n10518147/c10565180/content.html');
const isro2 = source('isro-2', 'Chandrayaan-2 — spacecraft, owner and mission account', 'https://www.isro.gov.in/Chandrayaan_2.html', 'Indian Space Research Organisation (ISRO)', 'India', 'English', english);
const isro2Report = source('isro-2-report', 'Department of Space — parliamentary answers, winter session 2019', 'https://www.isro.gov.in/media_isro/pdf/docs/UsefulLinks/ParliamentQuestions/winter_session_2019.pdf', 'Department of Space / ISRO', 'India', 'English', english);
const isro3 = source('isro-3', 'Chandrayaan-3 — dated mission updates, July–September 2023', 'https://www.isro.gov.in/Chandrayaan3.html', 'ISRO', 'India', 'English', english);
const isro3Design = source('isro-3-design', 'Chandrayaan-3 — mission objectives and payloads', 'https://www.isro.gov.in/Chandrayaan3_Details.html', 'ISRO', 'India', 'English', english);
const slim = source('jaxa-slim', '小型月着陸実証機（SLIM）の月面着陸の結果・成果等について — 25 January 2024', 'https://www.jaxa.jp/press/2024/01/20240125-1_j.html', 'Japan Aerospace Exploration Agency (JAXA)', 'Japan', 'Japanese', japanese);
const slimScience = source('jaxa-slim-science', '開発・運用状況 — SLIM surface operations', 'https://www.isas.jaxa.jp/home/slim/SLIM/operation_status/index.html', 'ISAS/JAXA', 'Japan', 'Japanese', japanese);
const ispace1 = source('ispace-1', 'HAKUTO-R Mission 1 landing analysis — 26 May 2023', 'https://www.ispace-inc.com/2023/05/26/ispace-announces-results-of-the-hakuto-r-mission-1-lunar-landing/', 'ispace, inc.', 'Japan', 'English', english);
const ispace1Ja = source('ispace-1-ja', 'HAKUTO-R ミッション1 成果報告 — 26 May 2023', 'https://www.ispace-inc.com/ja/2023/05/26/ispace、民間月面探査プログラム「hakuto-r」ミッション1-成/', 'ispace, inc.', 'Japan', 'Japanese', japanese);
const ispace1Launch = source('ispace-1-launch', 'ミッション1 打ち上げ及び分離 — 11 December 2022', 'https://www.ispace-inc.com/ja/2022/12/11/ispace、ミッション１のランダーの打ち上げ及びロケ/', 'ispace, inc.', 'Japan', 'Japanese', japanese);
const ispace2 = source('ispace-2', 'HAKUTO-R Mission 2 technical cause analysis — 24 June 2025', 'https://www.ispace-inc.com/2025/06/24/ispace-releases-technical-cause-analysis-for-hakuto-r-mission-2/', 'ispace, inc.', 'Japan', 'English', english);
const ispace2Ja = source('ispace-2-ja', 'ミッション2軟着陸未達に関する技術要因分析 — 24 June 2025', 'https://www.ispace-inc.com/ja/2025/06/24/ispace、ミッション2軟着陸未達に関する技術要因分析/', 'ispace, inc.', 'Japan', 'Japanese', japanese);
const ispace2Launch = source('ispace-2-launch', 'ミッション2 Success 1 — 14 January 2025', 'https://www.ispace-inc.com/ja/2025/01/14/ispace、ミッション2-マイルストーンのsuccess-1「打ち上げ準/', 'ispace, inc.', 'Japan', 'Japanese', japanese);
const spaceil = source('spaceil', 'אודות SpaceIL — Beresheet mission account', 'https://www.spaceil.com/אודות', 'SpaceIL', 'Israel', 'Hebrew', 'English paraphrase of the Hebrew original; Beresheet transliterates בראשית. This is not an official translation.');
const isa = source('isa', 'החללית בראשית: חללית ישראלית לירח', 'https://www.space.gov.il/inspiration/134163', 'Israel Space Agency', 'Israel', 'Hebrew', 'English paraphrase of the Hebrew original; this is not an official translation.');

type Facts = {
  representing: string[]; model: string; missionDates: string; objectives: string[];
  outcome: { landing: string; science: string }; exploration: string; publicSummary: string;
  educatorNotes: string; plannerNotes: string; operator?: string; sponsors?: string[];
  discoveries?: string[]; innovations?: string[];
};
function mission(id: string, name: string, primary: MissionSource, facts: Facts, extra: MissionSource[] = []): MissionHistoryRecord {
  const c = <T>(value: T) => cited(value, primary.id);
  return {
    id, siteIds: [id], name,
    operator: facts.operator ? c(facts.operator) : unknown('A separate flight operator is not established by the reviewed sources; the spacecraft builder is not assumed to be the operator.'),
    sponsors: facts.sponsors ? c(facts.sponsors) : unknown('Mission-specific sponsor attribution is not established in the reviewed sources. No funding amount or complete donor list is inferred.'),
    representing: c(facts.representing), model: { ...c(facts.model), note: 'Published spacecraft designation; no serial number or visual-model identity is inferred.' },
    missionDates: c(facts.missionDates), objectives: c(facts.objectives), outcome: c(facts.outcome),
    discoveries: facts.discoveries ? c(facts.discoveries) : unknown('No specific scientific discovery is established in these references; this does not mean no useful data were returned.'),
    innovations: facts.innovations ? c(facts.innovations) : unknown('No achieved technical innovation is established here; an intended capability is not an achieved result.'),
    exploration: {
      summary: c(facts.exploration),
      distanceKm: unknown('No reconciled surface traverse distance is supplied here. Flight distance, sampling depth and instrument reach are not surface travel.'),
      areaKm2: unknown('No measured exploration coverage area is established. A point, panorama or traverse length does not define an area.'),
    },
    publicSummary: c(facts.publicSummary),
    educatorNotes: { ...c(facts.educatorNotes), note: 'Teaching prompt based on the cited evidence; not a quotation or an agency claim.' },
    plannerNotes: { ...c(facts.plannerNotes), note: 'Evidence interpretation for this history card, not operational approval or a vehicle design limit.' },
    sources: [primary, ...extra],
  };
}

function earlyAttempt(n: number, date: string): MissionHistoryRecord {
  const r = mission(`luna-${n}`, `Luna ${n}`, lavChronology, {
    representing: ['Soviet Union (USSR)'], model: `Luna ${n} automatic station`, missionDates: `Impact: ${date} (UTC)`,
    objectives: ['Attempt a soft landing on the Moon.'],
    outcome: { landing: 'Crashed during the landing attempt.', science: 'No successful surface investigation is established by this account.' },
    exploration: 'No surface traverse documented; this is a failed landing attempt.',
    publicSummary: 'Reaching the Moon did not mean surviving the landing.',
    educatorNotes: 'Compare the intended soft landing with the reported crash. What observation would distinguish contact from a working surface station?',
    plannerNotes: 'A failed descent supplies no demonstrated surface operating envelope.',
  }, [sovietProgramme, sovietDates]);
  r.representing = cited(['Soviet Union (USSR)'], sovietProgramme.id);
  r.objectives = cited(['Attempt a soft landing on the Moon.'], sovietProgramme.id);
  r.missionDates = cited(`Impact: ${date} (UTC)`, sovietDates.id);
  return r;
}
function soviet(n: number, facts: Omit<Facts, 'representing'>, extras: MissionSource[] = []): MissionHistoryRecord {
  const r = mission(`luna-${n}`, `Luna ${n}`, lav(n), { representing: ['Soviet Union (USSR)'], ...facts }, [sovietDates, sovietProgramme, ...extras]);
  r.representing = cited(['Soviet Union (USSR)'], sovietProgramme.id);
  r.missionDates = cited(facts.missionDates, sovietDates.id);
  return r;
}

const luna9 = soviet(9, {
  model: 'Luna 9 automatic lunar station', missionDates: 'Touchdown: 1966-02-03 (UTC)',
  objectives: ['Soft-land and transmit close-up surface panoramas.'],
  outcome: { landing: 'First successful robotic soft landing on the Moon.', science: 'Returned surface panoramas and radiation measurements.' },
  discoveries: ['Images and survival of the station provided local evidence of a load-bearing surface.'],
  innovations: ['Inflatable shock absorbers protected a deployable surface station.'],
  exploration: 'Stationary panorama station; no rover traverse. The historic reported landing region is not a confirmed spacecraft location.',
  publicSummary: 'A camera finally showed the Moon from a surviving surface station.',
  educatorNotes: 'Use panoramas and successful support of the station as two observations. Ask how far a local observation supports a claim about all lunar soil.',
  plannerNotes: 'Local bearing evidence does not establish polar-footprint strength or a universal landing limit.',
}, [ikiPanoramas]);
luna9.outcome = cited({ landing: 'First successful robotic soft landing on the Moon.', science: 'Returned surface panoramas and radiation measurements.' }, ikiPanoramas.id);
luna9.discoveries = cited(['Images and survival of the station provided local evidence of a load-bearing surface.'], ikiPanoramas.id);
luna9.exploration.summary.sourceIds = [ikiPanoramas.id, sovietDates.id];
const luna13 = soviet(13, {
  model: 'Luna 13 automatic lunar station', missionDates: 'Touchdown: 1966-12-24 (UTC)',
  objectives: ['Image the surface and measure local soil properties.'],
  outcome: { landing: 'Soft landing achieved.', science: 'Panoramas and soil measurements returned despite failure of one camera.' },
  discoveries: ['Measured local soil density and mechanical properties.'],
  innovations: ['Deployed soil probes added contact measurements to imaging.'],
  exploration: 'Stationary measurements around the lander; probe reach is not a traversed or surveyed area.',
  publicSummary: 'Touching the soil added evidence that pictures alone could not provide.',
  educatorNotes: 'Compare images with probe measurements. A failed camera reduces one measurement channel without erasing the others.',
  plannerNotes: 'The reported programme completion coexists with instrument failures; local measurements do not qualify another terrain or vehicle.',
});
const luna15 = soviet(15, {
  model: 'Luna 15 sample-return station', missionDates: 'Impact: 1969-07-21 (UTC)',
  objectives: ['Collect lunar soil and return it to Earth.'],
  outcome: { landing: 'Descent ended in impact.', science: 'No lunar sample was returned.' },
  exploration: 'No successful surface sampling or traverse; the map pin remains an approximate reported crash region.',
  publicSummary: 'Reaching lunar orbit was only one step of a sample-return mission.',
  educatorNotes: 'Trace the chain from landing to collection, ascent and recovery. An unfinished chain cannot provide a laboratory sample.',
  plannerNotes: 'Orbital progress is not demonstrated sampling, ascent or surface survival capability.',
});
luna15.exploration.summary.sourceIds.push(sovietDates.id);
luna15.outcome.sourceIds.push(sovietProgramme.id);
const luna16 = soviet(16, {
  model: 'Luna 16 sample-return station', missionDates: 'Touchdown: 1970-09-20 (UTC)',
  objectives: ['Return a lunar soil sample to Earth automatically.'],
  outcome: { landing: 'Soft landing achieved.', science: 'Collected and returned lunar soil to Earth.' },
  innovations: ['First automated return of lunar soil to Earth.'],
  exploration: 'Stationary drilling and sample return; no surface rover traverse.',
  publicSummary: 'A robot brought lunar material home for laboratory study.',
  educatorNotes: 'Distinguish returning a sample from a later discovery made in a laboratory. Sample context matters when comparing sites.',
  plannerNotes: 'The direct-return architecture constrained landing region and timing; it is not a reusable launch-window solution for another vehicle.',
});
const luna17 = soviet(17, {
  model: 'Luna 17 lander with Lunokhod 1', missionDates: 'Touchdown: 1970-11-17 (UTC)',
  objectives: ['Deliver a remotely driven rover for surface investigations.'],
  outcome: { landing: 'Lunokhod 1 delivered successfully.', science: 'Rover returned imagery and performed surface investigations.' },
  innovations: ['Remotely controlled mobile laboratory on the lunar surface.'],
  exploration: 'Lunokhod 1 explored away from the stationary delivery lander. Lavochkin reports a 10,540 m traverse; no coordinate route or measured coverage area is supplied here.',
  publicSummary: 'A moving laboratory could compare locations rather than observe just one spot.',
  educatorNotes: 'Compare measurements along a traverse. Travel length is not the width of an instrument swath or the area actually sampled.',
  plannerNotes: 'The pin marks the delivery lander, not the rover track. Historical driving success does not establish current traversability.',
});
luna17.exploration.distanceKm = { ...cited(10.54, 'lav-17'), note: 'Lavochkin reports 10,540 m; converted to km. A historical total, not a route geometry or area.' };
const luna18 = mission('luna-18', 'Luna 18', lavChronology, {
  representing: ['Soviet Union (USSR)'], model: 'Luna 18 sample-return station', missionDates: 'Impact: 1971-09-11 (UTC)',
  objectives: ['Land and return a lunar soil sample.'],
  outcome: { landing: 'Crashed during landing.', science: 'No sample returned.' },
  exploration: 'No successful surface sample collection; the pin is an approximate historical crash region.',
  publicSummary: 'A sample-return attempt ended before a sample could come home.',
  educatorNotes: 'Separate the intended sample experiment from the crash evidence. A missing returned sample is not a measurement of soil composition.',
  plannerNotes: 'The impact region does not define a surveyed landing footprint or a demonstrated sampling capability.',
}, [sovietDates, sovietProgramme]);
luna18.representing = cited(['Soviet Union (USSR)'], sovietProgramme.id);
luna18.objectives.sourceIds = [sovietProgramme.id];
luna18.model.sourceIds = [sovietProgramme.id];
luna18.missionDates.sourceIds = [sovietDates.id];
luna18.exploration.summary.sourceIds = [sovietDates.id, lavChronology.id];
const luna20 = soviet(20, {
  model: 'Luna 20 sample-return station', missionDates: 'Touchdown: 1972-02-21 (UTC)',
  objectives: ['Return soil from the highland region near Mare Fecunditatis.'],
  outcome: { landing: 'Soft landing achieved.', science: 'Highland soil sample returned to Earth.' },
  discoveries: ['Returned soil differed in colour and particle characteristics from Luna 16 material.'],
  innovations: ['Extended robotic sample return to a highland site.'],
  exploration: 'Stationary sampling; site imagery guided sample selection. No rover traverse.',
  publicSummary: 'Sampling a different kind of terrain made comparisons possible.',
  educatorNotes: 'Compare the highland sample with Luna 16 material. Ask whether a difference reflects terrain, sampling location or measurement method.',
  plannerNotes: 'A successful historical highland return does not establish slope tolerance at another footprint.',
});
const luna21 = soviet(21, {
  model: 'Luna 21 lander with Lunokhod 2', missionDates: 'Touchdown: 1973-01-15 (UTC; 16 January in Moscow)',
  objectives: ['Deliver Lunokhod 2 for imaging, soil and magnetic investigations.'],
  outcome: { landing: 'Rover delivery succeeded; rover navigation system failed during landing.', science: 'Surface investigations continued; dust contamination later impaired power and thermal control.' },
  discoveries: ['Measured changes in surface composition and magnetic field along the traverse.'],
  innovations: ['Mobile imaging, compositional and magnetic measurements supported comparisons across terrain.'],
  exploration: 'Lunokhod 2 explored Le Monnier crater. Lavochkin gives historical path totals with differing scope; no reconciled total or coordinate route is adopted here.',
  publicSummary: 'Rover science continued despite a navigation failure, until dust limited operation.',
  educatorNotes: 'Compare observations at different points and document how navigation limitations affect their locations. Do not turn a path length into an explored area.',
  plannerNotes: 'Navigation and dust failures qualify the successful mission label. Historical traverse totals are not current terrain clearance evidence.',
});
luna21.exploration.distanceKm.note = 'Lavochkin lists 36.2 km for four lunar days and 37 km overall; later LROC revisions require separate reconciliation. No single total is adopted.';
const luna23 = mission('luna-23', 'Luna 23', lavChronology, {
  representing: ['Soviet Union (USSR)'], model: 'Luna 23 sample-return station', missionDates: 'Touchdown: 1974-11-06 (UTC)',
  objectives: ['Collect and return lunar soil.'],
  outcome: { landing: 'Damaged landing; spacecraft tipped onto its side.', science: 'Communicated after touchdown but returned no sample.' },
  exploration: 'No returned sample or rover traverse; LROC imagery shows the vehicle on its side.',
  publicSummary: 'Surviving contact and communicating did not complete the sample-return objective.',
  educatorNotes: 'Compare post-touchdown communication with later orbital imagery. These observations answer different questions from whether a sample returned.',
  plannerNotes: 'Treat this as a partial touchdown and failed sample return; no sampling performance envelope follows.',
}, [sovietDates, sovietProgramme, source('lroc-23', 'Luna 23 — vehicle found on its side', 'https://lroc.im-ldi.com/images/461', 'LROC / Arizona State University', 'United States', 'English', english)]);
luna23.representing.sourceIds = [sovietProgramme.id];
luna23.missionDates.sourceIds = [sovietDates.id];
luna23.objectives.sourceIds = ['lroc-23'];
luna23.model.sourceIds = [sovietProgramme.id];
luna23.outcome.sourceIds = ['lroc-23'];
luna23.exploration.summary.sourceIds = ['lroc-23'];
const luna24 = soviet(24, {
  model: 'Luna 24 sample-return station', missionDates: 'Touchdown: 1976-08-18 (UTC)',
  objectives: ['Drill and return a soil core from Mare Crisium.'],
  outcome: { landing: 'Soft landing achieved.', science: 'Drilled and returned a lunar soil core to Earth.' },
  innovations: ['A redesigned drill and core handling system collected a subsurface column.'],
  exploration: 'Stationary subsurface sampling; drill penetration is neither surface travel nor regional coverage.',
  publicSummary: 'A core preserved material from below the immediate surface.',
  educatorNotes: 'A core adds depth context to a sample. Ask which layers are preserved and how a single borehole limits regional interpretation.',
  plannerNotes: 'A returned core demonstrates this mission’s sampling chain, not extractable resources or drilling performance elsewhere.',
});
const luna25Source = source('iki-25', 'ЛУНА-25 — objectives and failed pre-landing manoeuvre', 'https://iki.cosmos.ru/research/missions/luna-25', 'IKI, Russian Academy of Sciences', 'Russia', 'Russian', russian);
const luna25 = mission('luna-25', 'Luna 25', luna25Source, {
  representing: ['Russia'], model: 'Luna 25 (Luna-Glob) lander', missionDates: 'Launch: 2023-08-11; failed pre-landing manoeuvre: 2023-08-19',
  objectives: ['Investigate polar regolith and exosphere; test landing and surface operation technologies.'],
  outcome: { landing: 'Lost before landing after an off-nominal orbital manoeuvre; impacted the Moon.', science: 'Planned surface investigations were not carried out.' },
  exploration: 'No surface traverse. The existing pin is a likely impact crater, not the planned south-polar landing site.',
  publicSummary: 'A polar science plan did not become a working polar surface station.',
  educatorNotes: 'Keep a proposed search for volatiles separate from a detection. Mission objectives are not evidence of water at a landing target.',
  plannerNotes: 'The impact marker supplies no polar site validation or demonstrated surface survival duration.',
}, [source('nasa-25-impact', 'LRO observes crater likely from Luna 25 impact — 31 August 2023', 'https://www.nasa.gov/humans-in-space/nasas-lro-observes-crater-likely-from-luna-25-impact/', 'NASA / LRO', 'United States', 'English', english)]);
const luna25Operator = source('lav-25', 'Луна-25 — mission control and spacecraft account', 'https://www.laspace.ru/ru/activities/projects/luna-glob/', 'NPO Lavochkin', 'Russia', 'Russian', russian);
luna25.sources.push(luna25Operator);
luna25.operator = cited('NPO Lavochkin mission control', luna25Operator.id);
luna25.sponsors = { ...cited(['Russian Federal Space Programme 2016–2025'], luna25Source.id), note: 'Programme attribution only; no funding amount or exhaustive contractor list.' };
luna25.exploration.summary.sourceIds = ['nasa-25-impact', luna25Source.id];

const change3 = mission('change-3', 'Chang’e 3 / Yutu', ce3, {
  operator: 'Chinese lunar exploration programme', representing: ['China'], model: 'Chang’e 3 lander and Yutu rover', missionDates: 'Touchdown: 2013-12-14 (UTC)',
  objectives: ['Land, deploy Yutu and conduct surface investigations.'],
  outcome: { landing: 'Lander and rover delivered successfully.', science: 'Engineering and science data returned; Yutu’s mechanism-control fault remained unresolved in March 2014.' },
  innovations: ['Lander and rover operated through lunar-night cycles.'],
  exploration: 'Yutu explored near the stationary lander; this card supplies no measured route or coverage area.',
  publicSummary: 'A successful landing and useful science can coexist with a rover malfunction.',
  educatorNotes: 'Track which instruments returned data before and after a fault. Compare an engineering milestone with the evidence available for a scientific conclusion.',
  plannerNotes: 'Separate lander survival from rover mobility; a mission-level success label does not qualify every subsystem.',
}, [ce3Context]);
change3.missionDates.sourceIds = [ce3Context.id];
const change4 = mission('change-4', 'Chang’e 4 / Yutu-2', ce4, {
  operator: 'Chinese lunar exploration programme', representing: ['China'], model: 'Chang’e 4 lander and Yutu-2 rover', missionDates: 'Touchdown: 2019-01-03 (UTC)',
  objectives: ['Soft-land and conduct far-side surface and rover investigations through a relay.'],
  outcome: { landing: 'First far-side soft landing achieved.', science: 'International and Chinese payload data downlinked; surface investigations followed engineering milestones.' },
  innovations: ['Queqiao relay supported far-side lander and rover communications.'],
  exploration: 'Yutu-2 investigated terrain away from the lander; the pin represents the lander, not a rover route.',
  publicSummary: 'A relay let a surface mission work on the side of the Moon hidden from Earth.',
  educatorNotes: 'Compare spectra and radar with surface images. Mineral interpretations require measurements and a geological model, not just a successful landing.',
  plannerNotes: 'Relay-supported history is not evidence of direct-to-Earth visibility; the present geometry tool must evaluate its own site and dates.',
}, [ce4Science]);
change4.discoveries = cited(['CNSA reported olivine and low-calcium pyroxene at individual observation points, with preliminary interpretation of their origin.'], ce4Science.id);
change4.educatorNotes.sourceIds.push(ce4Science.id);
const change5 = mission('change-5', 'Chang’e 5', ce5, {
  operator: 'Chinese lunar exploration programme / Beijing Aerospace Control Center', representing: ['China'], model: 'Chang’e 5 lander, ascender, orbiter and returner', missionDates: 'Lunar touchdown: 2020-12-01; Earth return: 2020-12-16 UTC (17 December in China)',
  objectives: ['Collect lunar samples and return them to Earth.'],
  outcome: { landing: 'Near-side landing and ascent succeeded.', science: 'Samples recovered on Earth for laboratory investigation.' },
  innovations: ['China’s first lunar sampling, ascent, lunar-orbit docking and sample return.'],
  exploration: 'Stationary sampling at the landing site; no measured surface traverse or coverage polygon.',
  publicSummary: 'The landing was one link in a chain that brought samples back to Earth.',
  educatorNotes: 'Separate sample acquisition from laboratory findings. Track collection context and handling before attributing an age or composition to the Moon.',
  plannerNotes: 'Lunar-orbit rendezvous and recovery are historical mission evidence; they do not set a universal landing or ascent envelope.',
});
const change6 = mission('change-6', 'Chang’e 6', ce6, {
  operator: 'Chinese lunar exploration programme / Beijing Aerospace Control Center', representing: ['China'], model: 'Chang’e 6 lander, ascender, orbiter and returner', missionDates: 'Lunar touchdown: 2024-06-01 UTC (2 June in China); Earth return: 2024-06-25',
  objectives: ['Collect far-side lunar samples and return them to Earth.'],
  outcome: { landing: 'Far-side landing and ascent succeeded.', science: 'Far-side samples recovered on Earth; collection success is separate from later analysis.' },
  innovations: ['First sample return from the lunar far side.'],
  exploration: 'Stationary sampling in the far-side landing region; no surveyed coverage area or coordinate route supplied.',
  publicSummary: 'For the first time, samples from the far side could be studied on Earth.',
  educatorNotes: 'Compare near-side and far-side samples while accounting for collection sites and measurement methods. A returned sample is not yet an explanation of lunar evolution.',
  plannerNotes: 'Relay-dependent sample return does not establish direct-to-Earth access or certify a new site.',
});
const chandrayaan2 = mission('chandrayaan-2', 'Chandrayaan-2 / Vikram', isro2, {
  operator: 'ISRO', representing: ['India'], model: 'Chandrayaan-2 orbiter, Vikram lander and Pragyan rover', missionDates: 'Launch: 2019-07-22; landing attempt: 2019-09-06 UTC (7 September in India)',
  objectives: ['Demonstrate soft landing and roving; investigate lunar composition and surface properties.'],
  outcome: { landing: 'Vikram hard-landed; soft landing and rover deployment failed.', science: 'Orbiter investigations continued independently of the failed surface attempt.' },
  exploration: 'No successful lander/rover surface traverse. Orbital remote sensing is not a landed exploration footprint.',
  publicSummary: 'The lander failed, but the orbiter remained a separate source of lunar science.',
  educatorNotes: 'Separate observations by platform: an orbital measurement cannot be presented as a rover measurement at the impact site.',
  plannerNotes: 'Orbiter longevity does not demonstrate lander surface survival, rover mobility or a safe footprint.',
}, [isro2Report]);
chandrayaan2.outcome.sourceIds.push(isro2Report.id);
chandrayaan2.objectives.sourceIds.push(isro2Report.id);
const chandrayaan3 = mission('chandrayaan-3', 'Chandrayaan-3 / Vikram / Pragyan', isro3, {
  operator: 'ISRO', representing: ['India'], model: 'Chandrayaan-3 Vikram lander and Pragyan rover', missionDates: 'Launch: 2023-07-14; touchdown: 2023-08-23 (UTC)',
  objectives: ['Demonstrate soft landing, rover travel and in-situ experiments.'],
  outcome: { landing: 'Soft landing succeeded and Pragyan deployed.', science: 'Surface instruments returned measurements before lander and rover entered sleep mode.' },
  discoveries: ['Rover laser-induced breakdown spectroscopy detected sulphur in material measured at the site.'],
  innovations: ['Demonstrated India’s lunar soft-landing and rover capability.'],
  exploration: 'Pragyan travelled near Vikram in the southern highlands; no coordinate route or measured coverage area is provided.',
  publicSummary: 'A landed laboratory and rover measured their immediate surroundings.',
  educatorNotes: 'A spectral sulphur detection concerns the sampled material. Ask how calibration and independent instruments support identification, and how far that evidence extends.',
  plannerNotes: 'A high-latitude landing does not establish conditions at the geographic pole. Local chemistry is not a water-deposit or resource estimate.',
}, [isro3Design]);
chandrayaan3.objectives.sourceIds = [isro3Design.id];
const slimRecord = mission('slim', 'SLIM', slim, {
  operator: 'JAXA / ISAS', representing: ['Japan'], model: 'Smart Lander for Investigating Moon (SLIM)', missionDates: 'Touchdown: 2024-01-19 UTC (20 January in Japan)',
  objectives: ['Demonstrate pinpoint landing and investigate nearby rocks.'],
  outcome: { landing: 'Pinpoint demonstration succeeded despite engine loss and an off-nominal resting attitude.', science: 'Engineering data returned; surface camera observations occurred during subsequent operations.' },
  innovations: ['Vision-based pinpoint landing demonstrated.'],
  exploration: 'Stationary SLIM observations; deployed LEV probes belong to this mission, not extra landing records. No measured coverage area supplied.',
  publicSummary: 'Landing close to a target and landing in the intended attitude are different achievements.',
  educatorNotes: 'Compare the stated pinpoint success criterion with the observed final attitude. Use images, telemetry and spectra to answer different questions.',
  plannerNotes: 'Pinpoint accuracy is not touchdown stability or a certified terrain envelope. Later operation does not validate an arbitrary lunar-night survival design.',
}, [slimScience]);
slimRecord.outcome.sourceIds.push(slimScience.id);
slimRecord.objectives.sourceIds.push(slimScience.id);
const hakuto1 = mission('hakuto-r-1', 'HAKUTO-R Mission 1', ispace1, {
  operator: 'ispace, inc.', representing: ['Japan (ispace-led commercial mission)'], model: 'HAKUTO-R Mission 1 lander', missionDates: 'Landing attempt: 2023-04-25 UTC (26 April in Japan)',
  objectives: ['Demonstrate commercial payload delivery and stable operation after landing.'],
  outcome: { landing: 'Soft landing failed after erroneous altitude estimation and fuel exhaustion.', science: 'Flight data supported failure analysis; customer payloads could not operate after landing.' },
  exploration: 'No successful surface traverse; carried rovers were payloads, not separate successful landing missions.',
  publicSummary: 'Useful flight telemetry did not make the failed payload delivery a surface science success.',
  educatorNotes: 'Compare estimated altitude with sensor data. Test whether terrain changes were represented in the simulations used to check the landing software.',
  plannerNotes: 'The operator linked the failure to software and validation assumptions. This history supplies no landing-site or payload operational approval.',
}, [ispace1Ja, ispace1Launch]);
hakuto1.sponsors = { ...cited(['NGK Spark Plug — named HAKUTO-R corporate partner'], ispace1Launch.id), note: 'One partner explicitly named in the December 2022 mission release; not a complete sponsor list or evidence of a funding amount.' };
hakuto1.exploration.summary.sourceIds.push(ispace1Launch.id);
const hakuto2 = mission('hakuto-r-2', 'HAKUTO-R Mission 2 / RESILIENCE', ispace2, {
  operator: 'ispace, inc.', representing: ['Japan (ispace-led commercial mission)'], model: 'RESILIENCE lander; TENACIOUS rover payload', missionDates: 'Landing attempt: 2025-06-05 UTC (6 June in Japan)',
  objectives: ['Deliver payloads and deploy the TENACIOUS rover.'],
  outcome: { landing: 'Hard landing after a laser range finder anomaly; soft landing failed.', science: 'Telemetry supported failure analysis; planned surface payload operations were not achieved.' },
  exploration: 'No successful surface exploration or rover deployment established; no traverse or coverage area.',
  publicSummary: 'A second attempt failed for a different reported technical reason from Mission 1.',
  educatorNotes: 'Compare the two failure analyses. Mission 2 implicated range-finder hardware; distinguish that evidence from Mission 1’s altitude-estimation software issue.',
  plannerNotes: 'The June 2025 analysis found a range-finder hardware anomaly and considered performance degradation likely. The deeper cause remained qualified, not a universal sensor limit.',
}, [ispace2Ja, ispace2Launch]);
hakuto2.model.sourceIds.push(ispace2Launch.id);
hakuto2.objectives.sourceIds = [ispace2Launch.id];
hakuto2.sponsors = { ...cited(['Sumitomo Mitsui Banking Corporation (SMBC) — official naming partner'], ispace2Launch.id), note: 'Attribution from the January 2025 mission release; not an exhaustive sponsor list or funding amount.' };
hakuto2.educatorNotes.sourceIds.push(ispace1.id);
hakuto2.sources.push(ispace1);
const beresheet = mission('beresheet', 'Beresheet / בראשית', spaceil, {
  operator: 'SpaceIL / Israel Aerospace Industries', representing: ['Israel'], model: 'Beresheet lander', missionDates: 'Launch: 2019-02-22; landing attempt: 2019-04-11',
  objectives: ['Attempt a soft landing and inspire interest in science and engineering.'],
  outcome: { landing: 'Crashed after disruptions led to engine shutdown during descent.', science: 'Lunar orbit achieved; a functioning surface mission was not established.' },
  exploration: 'No successful surface exploration or measured traverse; lunar orbit is not a surveyed surface footprint.',
  publicSummary: 'A privately led mission reached lunar orbit but could not complete its landing.',
  educatorNotes: 'Separate an educational goal, orbital achievement and a surface experiment. Each needs its own evidence of accomplishment.',
  plannerNotes: 'Orbital success does not demonstrate touchdown stability, instrument operation on the surface or site suitability.',
}, [isa]);
beresheet.operator.sourceIds = [isa.id];
beresheet.sponsors = { ...cited(['Israel Space Agency — documented support'], isa.id), note: 'Agency support is documented; no funding amount or complete private donor list is inferred.' };

export const INTERNATIONAL_MISSION_HISTORY: readonly MissionHistoryRecord[] = Object.freeze([
  earlyAttempt(5, '1965-05-12'), earlyAttempt(7, '1965-10-07'), earlyAttempt(8, '1965-12-06'),
  luna9, luna13, luna15, luna16, luna17, luna18, luna20, luna21, luna23, luna24, luna25,
  change3, change4, change5, change6, chandrayaan2, chandrayaan3, hakuto1, hakuto2, slimRecord, beresheet,
]);
