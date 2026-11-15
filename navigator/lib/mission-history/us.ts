import type { MissionHistoryRecord, MissionSource, Sourced } from "./types";

const fact = <T>(value: T, ...sourceIds: string[]): Sourced<T> => ({ value, sourceIds: [...new Set(sourceIds)] });
const unknown = (note: string): Sourced<never> => ({ value: null, sourceIds: [], note });
const source = (id: string, title: string, url: string, publisher = "NASA"): MissionSource => ({
  id, title, url, publisher, country: "United States", language: "English",
});
const noArea = () => unknown("No measured explored-area boundary is established by these references; distance is not area.");
const lunarHistory = source("nasa-lunar-history", "History of Lunar Exploration — Apollo sample findings",
  "https://science.nasa.gov/solar-system/moon/history-of-lunar-exploration/");
const apolloLandings = source("nasa-apollo-landings", "Apollo Lunar Landings — historical traverse summary",
  "https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html");
const nasaTraverseMaps = source("nasa-traverse-context", "Apollo Traverses on Earth — attributed traverse maps and scale comparisons",
  "https://www.nasa.gov/wp-content/uploads/static/history/alsj/TraverseMapsEarth.html");

type ApolloDetails = {
  number: number; lm: number; callSign: string; dates: string; objectives: string[];
  science: string; discoveries: string[]; innovation: string; summary: string;
  distance: number; distanceNote: string; publicSummary: string; method: string; limit: string;
};
const apolloDetails: ApolloDetails[] = [
  {
    number: 11, lm: 5, callSign: "Eagle", dates: "1969-07-16 launch; 1969-07-20 lunar landing; 1969-07-24 Earth return",
    objectives: ["Land a crew on the Moon and return safely to Earth.", "Collect surface samples and deploy surface experiments."],
    science: "Samples and surface experiments returned scientific evidence after the successful crewed landing.",
    discoveries: ["Returned mare samples showed that the dark plains are ancient volcanic lavas."],
    innovation: "First crewed lunar landing and ascent; manual maneuvering selected the final touchdown point.",
    summary: "A short walking EVA near Eagle; USGS provides a published traverse map showing the visit's limited extent.",
    distance: 0.25, distanceNote: "NASA's landing table reports 0.25 km. SP-4029 describes about 1 km traveled during the EVA; the summaries differ. Retain the table's reported traverse value, not a reconstructed track or radius.",
    publicSummary: "The first human Moon landing brought rocks back to Earth so scientists could study lunar history directly.",
    method: "Compare collected rocks with surface photographs: laboratory analysis identified ancient volcanic material.",
    limit: "A successful local landing does not establish conditions at other sites; NASA's account records manual hazard avoidance.",
  },
  {
    number: 12, lm: 6, callSign: "Intrepid", dates: "1969-11-14 launch; 1969-11-19 lunar landing; 1969-11-24 Earth return",
    objectives: ["Demonstrate precision landing and systematic mare exploration.", "Deploy ALSEP and sample the surface."],
    science: "Two EVAs returned samples and Surveyor 3 components; the surface television camera failed during deployment.",
    discoveries: ["Samples showed younger mare lavas than Apollo 11's, revealing variation between landing sites."],
    innovation: "Precision landing near Surveyor 3 enabled retrieval of hardware exposed to the lunar environment.",
    summary: "Two walking EVAs included Surveyor Crater and the separate Surveyor 3 lander; USGS provides a published traverse map.",
    distance: 1.35, distanceNote: "NASA's landing table reports 1.35 km; SP-4029 gives about 2.3 km traveled across both EVAs. These historical totals differ; neither supplies a coverage polygon here.",
    publicSummary: "Landing near an earlier robot let astronauts bring pieces of that robot home alongside lunar rocks.",
    method: "Compare samples from two mare sites to test whether visually similar plains share the same geological history.",
    limit: "Precision touchdown and useful science coexisted with a camera failure; a mission-level success label hides instrument losses.",
  },
  {
    number: 14, lm: 8, callSign: "Antares", dates: "1971-01-31 launch; 1971-02-05 lunar landing; 1971-02-09 Earth return",
    objectives: ["Investigate and sample the Fra Mauro formation.", "Deploy ALSEP and improve surface working techniques."],
    science: "Surface experiments and sample return succeeded; navigation difficulties curtailed the approach to Cone Crater's rim.",
    discoveries: ["Fra Mauro breccias preserved evidence of the giant Imbrium impact."],
    innovation: "The two-wheeled Modular Equipment Transporter carried tools and samples during walking exploration.",
    summary: "Walking EVAs with an equipment cart approached Cone Crater. USGS's postflight traverse map distinguishes actual and preplanned paths.",
    distance: 3.45, distanceNote: "NASA's landing table reports 3.45 km; SP-4029 describes more than 4 km traveled during the EVAs. This is a reported traverse total, not a uniquely resolved track length.",
    publicSummary: "Broken rocks at Fra Mauro helped scientists read the history of a much larger impact basin.",
    method: "Study the fragments and textures in breccias to distinguish impact debris from an undisturbed lava flow.",
    limit: "Surface navigation was difficult even with crew and maps; a published traverse is historical evidence, not a reusable safe route.",
  },
  {
    number: 15, lm: 10, callSign: "Falcon", dates: "1971-07-26 launch; 1971-07-30 lunar landing; 1971-08-07 Earth return",
    objectives: ["Sample Hadley–Apennine and deploy surface experiments.", "Evaluate extended stays and rover mobility; conduct orbital investigations."],
    science: "The first rover-assisted Apollo expedition returned samples and experiment data; drilling was more difficult than expected.",
    discoveries: ["The plagioclase-rich Genesis Rock provided evidence of ancient lunar crust; green glass recorded volcanic activity."],
    innovation: "The first Apollo Lunar Roving Vehicle extended sample collection beyond walking excursions.",
    summary: "Three rover excursions explored Hadley–Apennine, including Hadley Rille; USGS provides a published traverse map.",
    distance: 27.9, distanceNote: "SP-4029 reports about 27.9 km traveled in the LRV. NSSDCA's LRV overview reports 27.8 km; the historical totals differ and no geometric route length is derived here.",
    publicSummary: "A rover let the crew visit more geological settings and return evidence of both the ancient crust and volcanic activity.",
    method: "Connect each sampled rock to its field setting; the Genesis Rock and green glass answer different geological questions.",
    limit: "The recorded drive distance is an observation of this mission, not a general rover range or proof of traversability elsewhere.",
  },
  {
    number: 16, lm: 11, callSign: "Orion", dates: "1972-04-16 launch; 1972-04-20 lunar landing; 1972-04-27 Earth return",
    objectives: ["Survey and sample the Descartes highlands.", "Deploy surface experiments and conduct orbital investigations."],
    science: "Crew and samples returned safely, but a severed cable disabled the heat-flow experiment and the mission ended a day early.",
    discoveries: ["Predominantly impact-produced feldspathic breccias overturned the preflight interpretation of volcanic terrain."],
    innovation: "Rover-supported highlands fieldwork tested geological interpretations made from orbital photographs.",
    summary: "Three rover EVAs visited highland sampling stations; figure iii in NASA's sample catalog maps traverses and stations.",
    distance: 26.9, distanceNote: "SP-4029 reports 26.9 km traveled in the LRV. NSSDCA's separate LRV overview reports 26.7 km and the landing table rounds to 27 km; retain this source's precision and disagreement.",
    publicSummary: "Rocks collected on the ground changed scientists' explanation of terrain first studied from orbit.",
    method: "Test a volcanic-origin hypothesis against actual samples; impact breccias required revising the interpretation.",
    limit: "Successful touchdown did not preserve every experiment. Historical drive totals differ and cannot define a safe corridor or area.",
  },
  {
    number: 17, lm: 12, callSign: "Challenger", dates: "1972-12-07 launch; 1972-12-11 lunar landing; 1972-12-19 Earth return",
    objectives: ["Investigate and sample Taurus–Littrow.", "Deploy surface experiments and conduct orbital science."],
    science: "Three rover EVAs returned samples and experiment data; a damaged rover fender required a field repair.",
    discoveries: ["Orange volcanic material and highland breccias preserved different parts of lunar geological history."],
    innovation: "A trained geologist, Harrison Schmitt, worked on the surface as an astronaut, connecting field observations with sampling.",
    summary: "Three rover EVAs explored Taurus–Littrow, including Shorty Crater. The USGS-hosted TUB/DLR/LROC map reconstructs traverses from photomaps and images; no route is digitized here.",
    distance: 35.7, distanceNote: "SP-4029 reports 35.7 km driven. NSSDCA's LRV overview reports 35.9 km; this source-specific total is not a radius, surveyed area, or digitized route.",
    publicSummary: "A geologist on the Moon helped recognize unusual orange material that became evidence of past volcanic activity.",
    method: "Use field observations to select samples, then laboratory work to test the proposed volcanic origin of the orange material.",
    limit: "An achieved traverse reflects this vehicle, crew, terrain and timeline; it does not qualify another vehicle or landing site.",
  },
];

const apolloRecords: MissionHistoryRecord[] = apolloDetails.map((d) => {
  const id = `apollo-${d.number}`;
  const historyId = `${id}-sp4029`;
  const mapId = `${id}-map`;
  const sources = [source(historyId, `Apollo by the Numbers (SP-4029) — Apollo ${d.number} mission summary`,
    `https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_${d.number}a_Summary.htm`),
  lunarHistory, apolloLandings, nasaTraverseMaps];
  if (d.number === 11 || d.number === 12 || d.number === 15) sources.push(source(mapId, `Apollo ${d.number} traverse map — USGS Astrogeology`,
    `https://astrogeology.usgs.gov/search/map/apollo_${d.number}_traverse_map`, "U.S. Geological Survey"));
  if (d.number === 14) sources.push(source(mapId, "Apollo 14 traverse map — USGS Open-File Report 71-297 (postflight)",
    "https://pubs.usgs.gov/publication/ofr71297", "U.S. Geological Survey"));
  if (d.number === 16) sources.push(source(`${id}-samples`, "Apollo 16 Lunar Sample Catalog, Part 1 — traverse map (figure iii) and highlands interpretation",
    "https://www.nasa.gov/wp-content/uploads/static/history/alsj/a16/A16SampleCat_1.pdf"));
  if (d.number === 17) sources.push(source(mapId, "Apollo 17 landing site traverse map — TUB/DLR/LROC reconstruction, hosted by USGS",
    "https://astrogeology.usgs.gov/search/map/moon_apollo_17_lroc_nac_landing_site_orthomosaic_50cm", "U.S. Geological Survey (TUB/DLR/LROC authors)"));
  if (d.number >= 15) sources.push(source("nasa-lrv", "The Apollo Lunar Roving Vehicle — alternative historical drive totals",
    "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html"));
  const distanceSource = d.number <= 14 ? apolloLandings.id : historyId;
  const discoverySource = d.number === 16 ? `${id}-samples` : lunarHistory.id;
  const distanceSources = [distanceSource, historyId, ...(d.number >= 15 ? ["nasa-lrv"] : [])];
  return {
    id, siteIds: [id], name: `Apollo ${d.number}`,
    operator: fact("NASA — crewed Apollo mission operations", historyId),
    sponsors: fact(["NASA — United States government Apollo program"], historyId),
    representing: fact(["United States"], historyId),
    model: fact(`Apollo Lunar Module LM-${d.lm} “${d.callSign}”`, historyId),
    missionDates: fact(d.dates, historyId, apolloLandings.id),
    objectives: fact(d.objectives, historyId),
    outcome: fact({ landing: "Successful crewed lunar landing, ascent and Earth return.", science: d.science }, historyId),
    discoveries: fact(d.discoveries, discoverySource),
    innovations: fact([d.innovation], historyId),
    exploration: {
      summary: fact(d.summary, historyId, d.number === 16 ? `${id}-samples` : mapId),
      distanceKm: { ...fact(d.distance, ...new Set(distanceSources)), note: d.distanceNote },
      areaKm2: noArea(),
    },
    publicSummary: fact(d.publicSummary, historyId, discoverySource),
    educatorNotes: { ...fact(d.method, discoverySource, historyId), note: "Teaching interpretation of the cited observations and sample evidence." },
    plannerNotes: { ...fact(d.limit, historyId, ...new Set(distanceSources)), note: "Historical evidence limits; this is not operational approval or a vehicle design limit." },
    sources,
  };
});

type RobotDetails = {
  number: number; dates: string; model: string; objective: string; landing: string; science: string;
  discovery: string | null; innovation: string; summary: string; publicSummary: string; method: string; limit: string;
};
const surveyorDetails: RobotDetails[] = [
  {
    number: 1, dates: "1966-05-30 launch; 1966-06-02 touchdown; 1967-01-07 final contact", model: "Surveyor robotic soft lander",
    objective: "Demonstrate soft landing and image the surface in preparation for Apollo.",
    landing: "Successful US robotic soft landing in Oceanus Procellarum.", science: "Surface images and landing measurements were returned.",
    discovery: "Images revealed rocks and distant relief around the landed vehicle.",
    innovation: "Doppler-controlled descent and instrumented shock-absorbing footpads measured touchdown behavior.",
    summary: "Stationary imaging and touchdown measurements; no rover traverse.",
    publicSummary: "A robot reached the surface gently and sent back close views before astronauts arrived.",
    method: "Use images and footpad measurements as separate evidence about terrain and touchdown response.",
    limit: "One landed vehicle samples local conditions, not the bearing strength or hazards of an entire region.",
  },
  {
    number: 2, dates: "1966-09-20 launch; 1966-09-23 reported impact (UTC)", model: "Surveyor robotic soft lander",
    objective: "Attempt a soft landing and surface imaging at Sinus Medii.",
    landing: "Failed soft-landing attempt after a course-correction thruster failure caused a spin; spacecraft crashed.",
    science: "No landed surface investigation was accomplished.", discovery: null,
    innovation: "Repeated thruster-recovery attempts could not restore controlled flight.",
    summary: "No surface traverse; the existing pin is an approximate crash region.",
    publicSummary: "A failed steering correction prevented this robot from making its planned gentle landing.",
    method: "Separate intended measurements from observations actually returned; a target is not an observed landing point.",
    limit: "NASA's key dates give 23 September; its narrative also says 22 September. Preserve the UTC date convention and uncertain crash location.",
  },
  {
    number: 3, dates: "1967-04-17 launch; 1967-04-20 touchdown; 1967-05-04 final contact", model: "Surveyor lander with surface sampler",
    objective: "Image the surface and test soil response with a remotely operated sampler.",
    landing: "Bounced twice after a descent-radar problem, then settled into an operating soft landing.",
    science: "Returned images, trenching and bearing-test observations; Apollo 12 later retrieved components.",
    discovery: "Sampler tests provided evidence of cohesive soil capable of bearing a landed spacecraft locally.",
    innovation: "Remote manipulation tested soil mechanically rather than relying on pictures alone.",
    summary: "Sampler work near the stationary lander; Apollo 12's later walk belongs to Apollo 12, not this mission.",
    publicSummary: "This robot dug and tested lunar soil; astronauts later brought parts of it back for study.",
    method: "Compare visible soil disturbance with commanded mechanical tests; returned components permit a separate exposure study.",
    limit: "Bounces and later operation are distinct outcomes. Local sampler tests are not a universal lunar soil specification.",
  },
  {
    number: 4, dates: "1967-07-14 launch; 1967-07-17 contact lost during descent", model: "Surveyor lander with surface sampler",
    objective: "Soft-land at Sinus Medii, image the surface and investigate soil using a sampler and magnet.",
    landing: "Contact was lost before touchdown; a successful landing was not confirmed.",
    science: "No surface investigation was returned; NASA describes a possible retro-rocket explosion, not a confirmed cause.", discovery: null,
    innovation: "The planned sampler included a magnet to investigate magnetic material; its surface use was not achieved.",
    summary: "The existing marker denotes the intended target; the actual surface location is unknown.",
    publicSummary: "Loss of radio contact left the landing outcome unconfirmed and prevented the planned surface study.",
    method: "Keep a proposed failure mechanism separate from a measured diagnosis when telemetry stops early.",
    limit: "The target pin is not evidence of touchdown at that point; no surface performance can be inferred.",
  },
  {
    number: 5, dates: "1967-09-08 launch; 1967-09-11 touchdown; 1967-12-16 final contact", model: "Surveyor lander with alpha-scattering instrument",
    objective: "Land, image and determine the chemical composition and magnetic properties of surface material.",
    landing: "Successful touchdown despite a helium leak and an altered descent.",
    science: "Returned images and chemical measurements; a brief engine firing tested surface disturbance.",
    discovery: "Alpha-scattering measurements detected oxygen, silicon and aluminum in the soil.",
    innovation: "Alpha-scattering analysis supplied in-situ chemical evidence alongside a footpad magnet.",
    summary: "Local chemistry, imaging and an engine-disturbance experiment; no rover traverse.",
    publicSummary: "A recovered descent problem was followed by direct chemical measurements of lunar soil.",
    method: "Composition measurements test interpretations from photographs; engine firing provided an intervention with before-and-after observations.",
    limit: "A successful recovery from this helium leak is historical evidence, not a validated contingency for another vehicle.",
  },
  {
    number: 6, dates: "1967-11-07 launch; 1967-11-10 touchdown; 1967-11-17 hop; 1967-12-14 brief renewed contact", model: "Surveyor lander with alpha-scattering instrument",
    objective: "Image Sinus Medii and measure surface composition and mechanical properties.",
    landing: "Successful landing followed by a commanded liftoff and second touchdown.",
    science: "Returned images and chemical data; relocation exposed the original footpad impressions for study.",
    discovery: "Displaced views enabled stereo imaging and examination of the original landing footprints.",
    innovation: "NASA reports the first spacecraft liftoff from the Moon, followed by a short hop.",
    summary: "NASA reports about 2.5 m westward displacement during a hop, not a measured ground-traverse path or coverage area.",
    publicSummary: "A short hop let a robot look back at the marks its own landing had made.",
    method: "Changing the camera position permits stereo comparison and observation of previously hidden footprints.",
    limit: "Hop displacement does not measure path length, rover range or surveyed area; no route coordinates are supplied here.",
  },
  {
    number: 7, dates: "1968-01-07 launch; 1968-01-10 touchdown; 1968-02-21 mission end", model: "Surveyor lander with sampler and alpha-scattering instrument",
    objective: "Investigate the Tycho ejecta region scientifically beyond the early Apollo candidate sites.",
    landing: "Successful soft landing north of Tycho.",
    science: "Returned images, chemistry and soil tests; the sampler freed and repositioned the initially stuck chemical instrument.",
    discovery: "Highland material near Tycho was enriched in aluminum relative to the mare material studied by earlier landers.",
    innovation: "The robotic arm recovered a stuck instrument and moved it among samples.",
    summary: "Local robotic sampling and imaging at the lander; instrument repositioning is not a rover traverse.",
    publicSummary: "A robot explored highland material and used its arm to rescue an instrument that had not deployed properly.",
    method: "Compare different material types using the same chemical instrument to investigate local compositional variation.",
    limit: "Successful instrument recovery and local sampling do not define regional resources, terrain safety or future deployment reliability.",
  },
];

const surveyorRecords: MissionHistoryRecord[] = surveyorDetails.map((d) => {
  const id = `surveyor-${d.number}`;
  const ref = `${id}-nasa`;
  const program = "surveyor-1-program";
  return {
    id, siteIds: [id], name: `Surveyor ${d.number}`,
    operator: fact("NASA / Jet Propulsion Laboratory — mission management; Hughes Aircraft — spacecraft contractor", ref, program),
    sponsors: fact(["NASA — United States government Surveyor program"], ref, program),
    representing: fact(["United States"], ref),
    model: { ...fact(d.model, ref), note: "Published spacecraft/instrument designation; no unverified serial number or visual-model identity." },
    missionDates: { ...fact(d.dates, ref), ...(d.number === 2 ? { note: "NASA key dates give 23 September; narrative dates conflict. Matches the existing pin's UTC convention." } : {}) },
    objectives: fact([d.objective], ref),
    outcome: fact({ landing: d.landing, science: d.science }, ref),
    discoveries: d.discovery === null ? unknown("No surface discovery established: the planned landed investigation was not accomplished.") : fact([d.discovery], ref, ...(d.number === 7 ? [lunarHistory.id] : [])),
    innovations: { ...fact([d.innovation], ref), note: "Technical approach or operational lesson; a failed attempt is not an achieved surface demonstration." },
    exploration: {
      summary: fact(d.summary, ref, ...(d.number === 2 || d.number === 4 ? ["nasa-surveyor-locations"] : [])),
      distanceKm: unknown(d.number === 6 ? "The source reports hop displacement, not a measured traverse length." : "No measured surface-traverse distance is established for this lander."),
      areaKm2: noArea(),
    },
    publicSummary: fact(d.publicSummary, ref),
    educatorNotes: { ...fact(d.method, ref), note: "Teaching interpretation of the cited experiment or failure evidence." },
    plannerNotes: { ...fact(d.limit, ref), note: "Historical evidence limits; no operational approval or transferable soil/design limit." },
    sources: [source(ref, `Surveyor ${d.number} — NASA mission history`, `https://science.nasa.gov/mission/surveyor-${d.number}/`),
      source(program, "Surveyor 1 — NASA/JPL management and Hughes spacecraft procurement", "https://science.nasa.gov/mission/surveyor-1/"),
      ...(d.number === 7 ? [lunarHistory] : []),
      ...(d.number === 2 || d.number === 4 ? [source("nasa-surveyor-locations", "NASA table of lunar artifacts — uncertain Surveyor locations",
        "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html")] : [])],
  };
});

const rangerDetails: RobotDetails[] = [
  {
    number: 1, dates: "1961-08-23 launch; 1961-08-27 telemetry ceased; 1961-08-30 Earth reentry", model: "Ranger technology-test spacecraft",
    objective: "Test deep-space spacecraft systems and measure interplanetary particles and fields from a high Earth orbit.",
    landing: "No lunar landing attempt: failed upper-stage injection left the vehicle in low Earth orbit.",
    science: "The planned deep-space investigation was not reached; telemetry ended after battery depletion.", discovery: null,
    innovation: "NASA's first spacecraft mission to use an Earth parking orbit before attempted deep-space departure.",
    summary: "Earth-orbit test, not a lunar surface visit; no existing landing-site ID is assigned.",
    publicSummary: "The first Ranger tested the path toward deep-space flight but never escaped low Earth orbit.",
    method: "Separate spacecraft telemetry from the intended interplanetary experiment; the environment actually sampled matters.",
    limit: "An Earth-orbit failure supplies no evidence of lunar surface conditions or touchdown performance.",
  },
  {
    number: 2, dates: "1961-11-18 launch; 1961-11-19 Earth reentry", model: "Ranger Block 1 technology-test spacecraft",
    objective: "Validate spacecraft design and investigate the space environment in a highly elliptical Earth orbit.",
    landing: "No lunar landing attempt: the upper stage failed to inject the vehicle beyond low Earth orbit.",
    science: "The intended long-duration deep-space investigation was not accomplished.", discovery: null,
    innovation: "This repeated engineering test exposed an upper-stage attitude-control failure; it did not demonstrate lunar landing.",
    summary: "No lunar visit and no existing landing-site ID; the vehicle reentered Earth's atmosphere.",
    publicSummary: "Another launch-stage failure stopped the second Ranger before its planned deep-space work.",
    method: "NASA identifies a probable gyroscope fault from engineering evidence; retain that diagnostic uncertainty.",
    limit: "Upper-stage failure and spacecraft design performance are different questions; neither yields a lunar terrain limit.",
  },
  {
    number: 3, dates: "1962-01-26 launch; 1962-01-28 lunar miss", model: "Ranger Block 2 with balsa-protected seismometer capsule",
    objective: "Image the approaching Moon and deliver an impact-surviving seismometer capsule.",
    landing: "Missed the Moon after guidance and course-correction errors; entered heliocentric orbit.",
    science: "Returned interplanetary gamma-ray measurements, but no television images or surface seismology.",
    discovery: "NASA credits the mission with the first measurements of interplanetary gamma-ray flux.",
    innovation: "A balsa outer casing was intended to cushion the seismometer capsule; lunar deployment was not achieved.",
    summary: "No surface exploration; a lunar miss must not become a landing pin.",
    publicSummary: "It missed the Moon, yet an instrument still returned useful measurements during flight.",
    method: "Evaluate results by instrument and environment: useful cruise measurements do not imply surface mission success.",
    limit: "No lunar contact means no observed capsule survival, terrain response or surface scientific performance.",
  },
  {
    number: 4, dates: "1962-04-23 launch; 1962-04-26 lunar impact", model: "Ranger Block 2 with balsa-protected seismometer capsule",
    objective: "Transmit approach images and deliver a seismometer capsule to the lunar surface.",
    landing: "Uncontrolled far-side impact after a computer/sequencer power failure; no soft landing.",
    science: "Planned operations and imaging were prevented by the failure.", discovery: null,
    innovation: "First US spacecraft to reach another celestial body, despite failure of the planned scientific operations.",
    summary: "Intentional-impact mission with an uncontrolled outcome; no existing map pin or measured surface traverse.",
    publicSummary: "Reaching the Moon was a milestone, but impact alone did not achieve the scientific objectives.",
    method: "Judge destination reached and data returned separately when assessing a mission.",
    limit: "A destructive impact is not evidence of a successful soft landing or capsule survival.",
  },
  {
    number: 5, dates: "1962-10-18 launch; 1962-10-21 lunar miss", model: "Ranger Block 2 impact spacecraft",
    objective: "Attempt lunar impact with imaging and a surface seismometer experiment.",
    landing: "Power failure prevented course correction; missed the Moon and entered heliocentric orbit.",
    science: "Returned about four hours of gamma-ray data before loss of power; no surface investigation.",
    discovery: "Gamma-ray observations were obtained during flight; these were not measurements of lunar soil.",
    innovation: "The Block 2 impact approach carried imaging and seismometry; this flight did not achieve their lunar objectives.",
    summary: "No surface visit or existing landing-site ID.",
    publicSummary: "Brief instrument data survived a mission otherwise stopped by a power-system failure.",
    method: "Identify when data were recorded before assigning a scientific result to the Moon itself.",
    limit: "The failed power system does not establish surface endurance, thermal limits or terrain suitability.",
  },
  {
    number: 6, dates: "1964-01-30 launch; 1964-02-02 lunar impact", model: "Ranger Block 3 six-camera impact spacecraft",
    objective: "Transmit high-resolution photographs during approach to support Apollo site study.",
    landing: "Reached the Moon in an intentional impact; not a soft landing.",
    science: "A camera power-supply short circuit prevented all planned lunar photographs.", discovery: null,
    innovation: "Six television cameras replaced the earlier impact capsule, emphasizing imaging before destruction.",
    summary: "No surface traverse; arrival at the Moon did not deliver the intended photographic survey.",
    publicSummary: "The flight reached its destination on schedule, but the cameras returned none of the planned pictures.",
    method: "A trajectory can succeed while its scientific instrument fails; assess both outcomes explicitly.",
    limit: "Impact accuracy does not validate soft-landing performance, and this flight supplies no imagery-based hazard evidence.",
  },
  {
    number: 7, dates: "1964-07-28 launch; 1964-07-31 lunar impact", model: "Ranger Block 3 six-camera impact spacecraft",
    objective: "Obtain close-range photographs of lunar terrain before intentional impact.",
    landing: "Reached the Moon in a planned destructive impact.",
    science: "Returned 4,316 approach images before impact.",
    discovery: "Close images revealed mare terrain at much higher resolution than Earth-based views.",
    innovation: "Rapid approach imaging transmitted progressively finer detail until shortly before destruction.",
    summary: "Remote images along the approach, not a walked or driven surface route; no mapped coverage area is asserted.",
    publicSummary: "A probe that was meant to crash sent its close views home before it hit.",
    method: "Compare images at different ranges to distinguish the resolution gain from a change in actual terrain.",
    limit: "A smooth appearance in images does not itself establish soil strength, small-scale hazards or landing readiness.",
  },
  {
    number: 8, dates: "1965-02-17 launch; 1965-02-20 lunar impact", model: "Ranger-C six-camera impact spacecraft",
    objective: "Photograph Mare Tranquillitatis during approach to support candidate-site study.",
    landing: "Completed its planned lunar impact.", science: "Returned 7,137 photographs before impact despite a telemetry interruption during flight.",
    discovery: "Approach photography provided detailed views of a mare region of interest to Apollo planners.",
    innovation: "Earlier camera activation provided images comparable to Earth-based views for calibration.",
    summary: "Approach imaging only; no surface traverse or measured coverage polygon is provided.",
    publicSummary: "Thousands of pictures helped planners examine a possible region for future astronaut landings.",
    method: "Use overlapping resolution scales for calibration before interpreting the closest images.",
    limit: "The photographed region is not identical to every later landing footprint; imagery is not operational approval.",
  },
  {
    number: 9, dates: "1965-03-21 launch; 1965-03-24 lunar impact", model: "Ranger Block 3 (Ranger-D) six-camera impact spacecraft",
    objective: "Image the geologically interesting Alphonsus crater before impact.",
    landing: "Completed a planned impact within Alphonsus crater.", science: "Returned 5,814 images, including pictures converted for live television viewing.",
    discovery: "High-resolution images documented Alphonsus; the target's suspected recent volcanism was a question, not a confirmed discovery here.",
    innovation: "Cameras aimed along the direction of flight delivered approach imagery for live public viewing.",
    summary: "Imaging before impact; no surface traverse or coordinate route is asserted.",
    publicSummary: "The final Ranger let viewers watch increasingly close lunar scenes before the probe struck the surface.",
    method: "Distinguish the scientific motivation for selecting Alphonsus from what its photographs actually demonstrate.",
    limit: "No surface survival was intended; neither photographic resolution nor successful impact establishes lander tolerances.",
  },
];

// Ranger has no IDs in the current landing list/catalog. Retain program history
// without inventing pins or binding impact missions to unrelated planner sites.
const rangerRecords: MissionHistoryRecord[] = rangerDetails.map((d) => {
  const id = `ranger-${d.number}`;
  const ref = `${id}-nasa`;
  return {
    id, siteIds: [], name: `Ranger ${d.number}`,
    operator: fact("NASA / Jet Propulsion Laboratory — mission design and management", ref),
    sponsors: fact(["NASA — United States government Ranger program"], ref),
    representing: fact(["United States"], ref),
    model: fact(d.model, ref), missionDates: fact(d.dates, ref), objectives: fact([d.objective], ref),
    outcome: fact({ landing: d.landing, science: d.science }, ref),
    discoveries: d.discovery === null ? unknown("No lunar scientific discovery is established in this mission reference.") : fact([d.discovery], ref),
    innovations: { ...fact([d.innovation], ref), note: "Technical approach or historical milestone; not a claim that every planned demonstration succeeded." },
    exploration: { summary: fact(d.summary, ref), distanceKm: unknown("No ground traverse was performed; approach/flyby distance is not a surface traverse."), areaKm2: noArea() },
    publicSummary: fact(d.publicSummary, ref),
    educatorNotes: { ...fact(d.method, ref), note: "Teaching interpretation of the cited mission evidence." },
    plannerNotes: { ...fact(d.limit, ref), note: "Historical evidence limits; not operational approval or a reusable vehicle limit." },
    sources: [source(ref, `Ranger ${d.number} — NASA mission history`, `https://science.nasa.gov/mission/ranger-${d.number}/`)],
  };
});

const odysseusSources: MissionSource[] = [
  source("im1-results", "NASA Collects First Surface Science in Decades via Commercial Moon Mission — 1 March 2024",
    "https://www.nasa.gov/missions/artemis/clps/nasa-collects-first-surface-science-in-decades-via-commercial-moon-mission/"),
  source("im1-pds", "NASA PDS — Nova-C Lunar Lander, Odysseus (instrument-host context, version 1.1)",
    "https://pds.nasa.gov/ds-view/pds/viewContext.jsp?identifier=urn%3Anasa%3Apds%3Acontext%3Ainstrument_host%3Aspacecraft.clps_to_2im_ncll&version=1.1"),
  source("im1-scalpss", "SCALPSS Development and Performance — SCALPSS 1.0 payload performance",
    "https://ntrs.nasa.gov/api/citations/20240005561/downloads/SCALPSS_development_240501.pdf"),
  source("im1-launch", "NASA Science Aboard Intuitive Machines Continues Journey to Moon — 17 February 2024",
    "https://www.nasa.gov/blogs/missions/2024/02/17/nasa-science-aboard-intuitive-machines-continues-journey-to-moon/"),
];
const odysseus: MissionHistoryRecord = {
  id: "odysseus", siteIds: ["odysseus"], name: "IM-1 Odysseus",
  operator: fact("Intuitive Machines — commercial spacecraft operator", "im1-pds", "im1-launch"),
  sponsors: fact(["NASA — government customer for instrument delivery under CLPS", "Commercial payload customers also contracted with Intuitive Machines"], "im1-launch", "im1-pds"),
  representing: fact(["United States commercial mission carrying NASA payloads"], "im1-results"),
  model: fact("Nova-C-class lunar lander “Odysseus”", "im1-pds"),
  missionDates: fact("2024-02-15 launch; 2024-02-22 touchdown; science operations ceased seven days after landing", "im1-launch", "im1-results"),
  objectives: fact(["Deliver NASA science and technology instruments to the southern lunar region.", "Investigate radio environment, navigation, propellant measurement and plume–surface interaction."], "im1-results", "im1-launch", "im1-scalpss"),
  outcome: fact({ landing: "Reached the surface but came to rest on its side: off-nominal touchdown with operations.", science: "Returned engineering and science data; SCALPSS did not collect the intended plume–surface interaction data." }, "im1-pds", "im1-results", "im1-scalpss"),
  discoveries: fact(["Instruments measured radio noise from Earth and the Sun; data return is distinct from completion of every experiment."], "im1-results", "im1-scalpss"),
  innovations: fact(["First flight of the Nova-C-class lander used a cryogenic liquid-oxygen/methane propulsion system for commercial lunar delivery."], "im1-pds"),
  exploration: { summary: fact("Lander-based measurements; no measured ground traverse or exploration-area boundary is provided.", "im1-pds"), distanceKm: unknown("No measured ground traverse in these mission references."), areaKm2: noArea() },
  publicSummary: fact("A commercial lander returned useful lunar data despite ending up on its side, while some planned measurements were lost.", "im1-results", "im1-scalpss"),
  educatorNotes: { ...fact("Compare instrument-level results with the overall delivery milestone: radio measurements succeeded while plume imaging did not.", "im1-results", "im1-scalpss"), note: "Teaching interpretation of the cited payload results." },
  plannerNotes: { ...fact("Treat the sideways attitude, returned data and missed measurements separately. Flight heritage does not establish landing reliability or another site's suitability.", "im1-pds", "im1-scalpss"), note: "Historical evidence limits; not operational approval." },
  sources: odysseusSources,
};

const blueGhostSources: MissionSource[] = [
  source("bg1-operator", "Blue Ghost Mission 1: Ghost Riders in the Sky — mission and payload details",
    "https://fireflyspace.com/missions/blue-ghost-mission-1/", "Firefly Aerospace"),
  source("bg1-results", "Firefly Aerospace Successfully Completes 14 Days of Surface Operations on the Moon — 17 March 2025",
    "https://investors.fireflyspace.com/news-releases/news-release-details/firefly-aerospace-successfully-completes-14-days-surface", "Firefly Aerospace"),
];
const blueGhost: MissionHistoryRecord = {
  id: "blue-ghost-1", siteIds: ["blue-ghost-1"], name: "Blue Ghost Mission 1",
  operator: fact("Firefly Aerospace — commercial lander developer and operator", "bg1-operator"),
  sponsors: fact(["NASA — government CLPS delivery customer"], "bg1-operator", "bg1-results"),
  representing: fact(["United States commercial delivery for NASA", "Italian Space Agency (ASI) — LuGRE payload partner with NASA"], "bg1-operator"),
  model: fact("Blue Ghost lunar lander (Mission 1)", "bg1-operator"),
  missionDates: fact("2025-01-15 launch; 2025-03-02 touchdown; 2025-03-16 final data received (US Central daylight time)", "bg1-operator", "bg1-results"),
  objectives: fact(["Deliver and operate NASA's ten CLPS payloads at Mare Crisium.", "Investigate lunar interior and surface behavior; demonstrate navigation, sampling, computing and dust mitigation."], "bg1-operator"),
  outcome: fact({ landing: "Successful upright soft landing at Mare Crisium.", science: "Firefly reported all ten NASA instruments operated and collected data, with all mission objectives met after more than fourteen days on the surface." }, "bg1-results"),
  discoveries: fact(["LuGRE acquired GPS and Galileo signals on the lunar surface; LEXI returned X-ray images to study solar wind interacting with Earth's magnetic field."], "bg1-results"),
  innovations: fact(["Integrated demonstrations included lunar GNSS reception, pneumatic sample collection and an electrodynamic dust shield."], "bg1-operator", "bg1-results"),
  exploration: { summary: fact("Stationary lander with deployed instruments at Mare Crisium; deployments and drilling are not a rover traverse or surveyed area.", "bg1-operator"), distanceKm: unknown("No measured lander/rover ground traverse in these references."), areaKm2: noArea() },
  publicSummary: fact("A commercial lander supported a full lunar day of experiments and continued briefly after sunset.", "bg1-results"),
  educatorNotes: { ...fact("Separate collecting instrument data from publishing an interpretation; a completed technology demonstration and a scientific discovery require different evidence.", "bg1-results"), note: "Teaching interpretation of the operator's mission-completion report." },
  plannerNotes: { ...fact("Attribute mission-completion claims to Firefly. This single flight does not qualify future thermal endurance, landing reliability or regional resources.", "bg1-results"), note: "Historical evidence limits; no operational approval." },
  sources: blueGhostSources,
};

const athenaSources: MissionSource[] = [
  source("im2-results", "NASA Receives Some Data Before Intuitive Machines Ends Lunar Mission — 7 March 2025",
    "https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/"),
  source("im2-prime", "Polar Resources Ice Mining Experiment 1 (PRIME-1) — objectives and instruments",
    "https://www.nasa.gov/mission/polar-resources-ice-mining-experiment-1-prime-1/"),
];
const athena: MissionHistoryRecord = {
  id: "athena", siteIds: ["athena"], name: "IM-2 Athena",
  operator: fact("Intuitive Machines — commercial launch, delivery and surface-operations responsibility", "im2-results"),
  sponsors: fact(["NASA — government CLPS instrument-delivery customer", "NASA STMD — partial funding of Micro Nova hopper and Nokia communications demonstrations"], "im2-results", "im2-prime"),
  representing: fact(["United States commercial mission carrying NASA payloads"], "im2-results"),
  model: fact("Nova-C lunar lander “Athena”", "im2-results"),
  missionDates: fact("2025-02-27 launch UTC (26 February US Eastern); 2025-03-06 touchdown; 2025-03-07 early mission end", "im2-results"),
  objectives: fact(["Use PRIME-1's TRIDENT drill and MSOLO mass spectrometer to extract and analyze subsurface material for volatiles.", "Demonstrate supporting mobility and communications technologies."], "im2-results", "im2-prime"),
  outcome: fact({ landing: "Touched down in a crater and rested on its side; batteries depleted before full operation.", science: "Some checkouts and data return succeeded, but the planned drilling and full instrument objectives were not achieved." }, "im2-results"),
  discoveries: fact(["MSOLO detected species NASA considered likely to come from propulsion gases; this is not a confirmed lunar ice detection."], "im2-results"),
  innovations: fact(["TRIDENT demonstrated its range of motion; attempted drilling, hopper and communications demonstrations achieved only part of their objectives."], "im2-results"),
  exploration: { summary: fact("Brief operations from the sideways lander; planned hopper travel is not an achieved measured traverse.", "im2-results"), distanceKm: unknown("No achieved, measured traverse is established by these references."), areaKm2: noArea() },
  publicSummary: fact("Athena returned some data, but its sideways landing prevented the planned search below the surface.", "im2-results"),
  educatorNotes: { ...fact("Account for spacecraft exhaust when interpreting detected gases; a signal alone does not establish a lunar source.", "im2-results"), note: "Teaching interpretation of NASA's propulsion-gas attribution." },
  plannerNotes: { ...fact("Partial checkouts do not validate drilling into lunar ice, hopper range or resource extraction. NASA reports incomplete objectives.", "im2-results"), note: "Historical evidence limits; no operational approval or resource estimate." },
  sources: athenaSources,
};

const lcrossSources: MissionSource[] = [
  source("lcross-nasa", "LCROSS — NASA mission history and impact results", "https://science.nasa.gov/mission/lcross/"),
  source("lcross-ames", "What is LCROSS, the Lunar Crater Observation and Sensing Satellite? — Ames mission leadership",
    "https://www.nasa.gov/general/what-is-lcross-the-lunar-crater-observation-and-sensing-satellite/"),
];
const lcross: MissionHistoryRecord = {
  id: "lcross-cabeus", siteIds: ["lcross-cabeus"], name: "LCROSS at Cabeus",
  operator: fact("NASA Ames Research Center — mission lead; Northrop Grumman — spacecraft and integration partner", "lcross-ames"),
  sponsors: fact(["NASA — United States government; originally funded through the Constellation program"], "lcross-nasa"),
  representing: fact(["United States"], "lcross-nasa"),
  model: fact("LCROSS shepherding spacecraft (S-S/C), accompanying the Centaur impactor", "lcross-nasa"),
  missionDates: fact("2009-06-18 launch; 2009-10-09 Centaur and LCROSS impacts at Cabeus", "lcross-nasa"),
  objectives: fact(["Test for water ice in a permanently shadowed south-polar crater by observing an impact plume.", "Test modular subsystems for future missions."], "lcross-nasa"),
  outcome: fact({ landing: "Intentional destructive impacts, not soft landings; LCROSS observed the Centaur plume before its own impact.", science: "Water was detected in the excavated material despite a pre-impact propellant-loss anomaly." }, "lcross-nasa"),
  discoveries: fact(["Impact-plume observations established water in material excavated at Cabeus; this is local evidence, not a map of mineable reserves."], "lcross-nasa"),
  innovations: fact(["A shepherding spacecraft observed the plume created by its spent launch stage before itself impacting."], "lcross-nasa"),
  exploration: { summary: fact("Remote sensing of impact-excavated material at Cabeus; the legacy catalog ID is preserved without adding a landing-site pin or footprint.", "lcross-nasa"), distanceKm: unknown("No ground traverse: the spacecraft deliberately impacted after plume observations."), areaKm2: noArea() },
  publicSummary: fact("A planned crash threw material into view and revealed water in a dark polar crater.", "lcross-nasa"),
  educatorNotes: { ...fact("An impact exposed material for remote measurement; distinguish a sampled plume from a continuous regional ice survey.", "lcross-nasa"), note: "Teaching interpretation of the impact experiment's sampling limits." },
  plannerNotes: { ...fact("A water detection at Cabeus does not establish deposit extent, extraction yield, surface trafficability or landing readiness.", "lcross-nasa"), note: "Historical evidence limits; not operational approval or a resource estimate." },
  sources: lcrossSources,
};

/** Static history only: never feeds canonical landing assessment or site coordinates. */
export const US_MISSION_HISTORY: readonly MissionHistoryRecord[] = [
  ...apolloRecords, ...surveyorRecords, ...rangerRecords, odysseus, blueGhost, athena, lcross,
];
