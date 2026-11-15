export const RESOURCES = [
 {id:'gods-eye-view',name:'God’s Eye View · Bilawal Sidhu',role:'Earth-layer implementation reference',kind:'MIT source reference',url:'https://github.com/bilawalsidhu/gods-eye-view',detail:'Reviewed satellite propagation, common-frame orbit display, provider provenance, age limits and cache budgets. Source code is a resource, not observational evidence or a Moon relay service. Third-party imagery/data retain separate terms.'},
 {id:'celestrak-orbits',name:'CelesTrak GP / OMM',role:'Dated Earth-orbit elements',kind:'Bundled snapshot, explicit refresh and JSON import',url:'https://celestrak.org/NORAD/documentation/gp-data-formats.php',detail:'SGP4-predicted satellite positions at a separate orbit UTC; epoch and source visible. The ±72h display policy is not accuracy certification. Refreshes cached at least two hours; unsupported mission-date extrapolation is hidden.'},
 {id:'starcloud-1',name:'Starcloud-1',role:'Orbital computing example',kind:'Operator mission description',url:'https://www.starcloud.com/starcloud-1',detail:'NORAD66303 carries an NVIDIA H100 GPU for an orbital computing demonstration. Educational context for onboard processing, power and downlink tradeoffs; not a lunar relay or contracted computing service.'},
 {id:'noaa-nowcoast',name:'NOAA nowCOAST',role:'Observed Earth-weather resource',kind:'External observation reference',url:'https://nowcoast.noaa.gov/',detail:'Observed radar and satellite weather are distinct from a model forecast. This link does not install a live global weather layer or convert cloud brightness into communication loss. Check product coverage and timestamps.'},

  {
    id: "horizons",
    name: "JPL Horizons",
    role: "Sun & Earth geometry",
    kind: "Computed data",
    url: "https://ssd.jpl.nasa.gov/horizons/",
    detail:
      "Catalogued DE441-derived hourly geometry, 2026-01-01 through the 2028-01-01 boundary; no interval beyond that boundary. Local Earth geometry includes parallax. Apparent-coordinate and frame assumptions are documented in the planning evidence review.",
  },
  {
    id: "lola",
    name: "LOLA · NASA Goddard",
    role: "Numerical terrain & horizons",
    kind: "Computed data",
    url: "https://pgda.gsfc.nasa.gov/products/90",
    detail:
      "Catalog horizons from 40 m / 240 m DEMs. Displayed terrain uses nested 5 m, 10 m, 40 m and 80 m LOLA products where covered; source and display sampling are distinct. A close zoom inside the south-polar cap switches to a measured inspection mesh so the ridges stay visible.",
  },
  {
    id: "lola-site04",
    name: "LOLA Site 04 · 5 m",
    role: "Shackleton rim close-up",
    kind: "Measured elevation",
    url: "https://pgda.gsfc.nasa.gov/products/78",
    detail:
      "NASA's 5 m south-pole site DEM, with 20 m, 60 m and 150 m LOLA context. The close-up is lit for inspection. It does not change the sunlight calculation.",
  },
  {
    id: "lroc-stereo",
    name: "LROC / DLR Shackleton stereo",
    role: "2 m rim elevation",
    kind: "Measured elevation",
    url: "https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_ESALL_SR12",
    detail:
      "NAC_DTM_ESALL_SR12, confidence class 14 only, blended into LOLA over 20 m at the holes. NASA / GSFC / Arizona State University, DLR and the ESA Lunar Lander project.",
  },
  {
    id: "trek",
    name: "NASA Moon Trek",
    role: "LROC south-pole imagery",
    kind: "Bundled imagery and optional online detail",
    url: "https://trek.nasa.gov/moon/",
    detail:
      "Bundled LROC WAC regional images and NAC cutouts where supported, with optional online NAC detail south of 85.5°S. Acquisition shadows are historical, not selected-date illumination; missing image coverage does not create measured heights.",
  },
  {
    id: "nasa-globe",
    name: "NASA LRO topographic Moon",
    role: "Original globe geometry and 8K image",
    kind: "Visualization asset",
    url: "https://svs.gsfc.nasa.gov/14959/",
    detail: "NASA Goddard’s original topographic model, retaining all 1,015,808 triangles. Its unitless relief is shown at a nominal globe scale and includes documented polar artifacts. Local LOLA data supplies measured site relief and flight contact; the globe does not supply scientific heights.",
  },
  {
    id: "quickmap",
    name: "LROC QuickMap",
    role: "Site imagery & independent exploration",
    kind: "Reference viewer",
    url: "https://quickmap.lroc.asu.edu/",
    detail:
      "Explore the underlying LRO instruments and compare site context in the challenge’s linked viewer. The imagery layer here uses LROC data served by Moon Trek; QuickMap itself is not queried as an API.",
  },
  {
    id: "csa",
    name: "Canadian Space Agency",
    role: "Moon exploration & teaching",
    kind: "Learning resource",
    url: "https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/",
    detail:
      "Canada’s lunar science, Artemis, Gateway and rover programmes. Used for attributed teaching context, not numerical calculations.",
  },
] as const;
export const LESSONS = [
  {
    id: "terrain",
    title: "A ridge can change a mission",
    question: "Will a perfectly smooth Moon give this site more sunlight?",
    explanation:
      "At a polar ridge, the visible horizon can fall below the local horizontal. A site can see sunlight while the Sun’s centre lies below a smooth-sphere horizon. Compare the terrain and sphere numbers for your selected dates.",
  },
  {
    id: "height",
    title: "Look over the rim",
    question: "Does raising an antenna also change the sunlight?",
    explanation:
      "An observer above the surface sees a different terrain horizon. Compare 0 m, 2 m and 10 m at a published site. Custom coordinates use only the precomputed 2 m horizon.",
  },
  {
    id: "date",
    title: "Move the landing date",
    question: "Could a one-week delay change the best landing site?",
    explanation:
      "The Moon’s polar Sun stays close to the horizon. Small changes in direction can put a crater rim in the way. Move the date and compare the sunlight and Earth-view windows.",
  },
] as const;
