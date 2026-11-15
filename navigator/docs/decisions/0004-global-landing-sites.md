# Global landing history without fabricated terrain coverage

Luke requested Apollo and the other lunar landing sites in addition to the polar mission candidates. The polar projection cannot represent those equatorial and northern locations usefully, so the workbench gains a separate whole-Moon equirectangular 2D map alongside its polar map and NASA globe.

A sourced mission inventory is adapted into the site selector. Apollo, robotic landings, off-nominal touchdowns and failed attempts are explicitly distinguished. Approximate regions and planned targets are labelled; a planned target is never presented as an observed landing. Existing catalog locations retain their measured masks and coordinates when enriched with mission metadata.

New global sites without a prepared terrain horizon get empty/unknown horizon data. Celestial directions and the smooth-sphere reference can be computed globally from the existing ephemerides. Power, contact and date rankings that require unknown terrain remain unknown or unavailable. Globe artwork is not used to invent scientific elevation or landing hazards.

Scenario latitude bounds become −90° to90°, with existing polar scenarios remaining compatible. The selected historic site, comparison, source link and audience tools share the same scenario; choosing a nonpolar site automatically selects the whole-Moon map. The polar view filters out off-map historic pins.

Validation: source/coordinate inventory tests, no fabricated-mask adapter tests, global map inverse/dateline/zoom tests, real Apollo selection and save/share roundtrips, and a fresh Horizons comparison at a nonpolar site.
