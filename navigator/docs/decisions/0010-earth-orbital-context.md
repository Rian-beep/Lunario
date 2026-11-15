# Earth orbital context has its own dated clock

Earth spacecraft are optional educational context, separate from lunar mission assessment. Use satellite.js 6.0.2 SGP4 with dated CelesTrak GP elements. Markers are predictions, not measured locations or an assertion of active service. Satellite identities and mission descriptions are independently sourced. An Earth satellite is not automatically a lunar relay.

The orbital clock defaults to the latest bundled element epoch. Lunar scenarios commonly use 2027, well beyond these elements: silently extrapolating would create misleading coverage. Hide predictions beyond ±72 hours, a conservative display policy rather than an accuracy guarantee. Explicit user refresh/import replaces the validated catalogue; errors retain the dated prior catalogue. No background polling. The web provider coalesces requests and caches attempts for two hours; offline users import replacement JSON.

SGP4 produces TEME coordinates. Markers use GMST to Earth-fixed coordinates, then scene axes [x,z,−y], all in kilometres. One orbit trace uses one display-time Earth frame so the selected marker lies on its path. DSN observer look angles are geometric context, not contact availability, frequency compatibility, weather loss, booking or a mission assessment input. High-precision EOP/frame work remains outside this illustrative layer.

God’s Eye View informed propagation, provenance, age, update and cache handling. Its Cesium stack, terrestrial imagery, surveillance sources and unrelated feeds are not copied. Both MIT notices ship in web and offline distributions. The NASA assets, lunar ephemeris and canonical assessment remain unchanged.

Validation includes independently generated Python sgp4 reference vectors, malformed/stale identity handling, provider failure/cache tests and web/file browser journeys. See docs/research/GODS-EYE-REVIEW.md and release QA for exact evidence.
