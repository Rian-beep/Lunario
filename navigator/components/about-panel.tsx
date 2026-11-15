import type { Catalog } from "@/lib/catalog";

export function AboutPanel({ catalog }: { catalog: Catalog }) {
  const v = catalog.meta.validation;
  return (
    <article className="max-w-3xl space-y-8 text-[1.05rem] leading-relaxed">
      <section className="space-y-3">
        <h2 className="font-display text-3xl">What this is</h2>
        <p>
          Lunario Lunar Landing Site Navigator is a planning instrument for the Moon&apos;s south pole.
          It compares candidate landing sites and dates by showing where the Sun and Earth sit relative to
          the local horizon. Sunlight is the power question. A clear line of sight to Earth is the
          direct-communication question.
        </p>
        <p>
          It was built for the 2026 NASA Space Apps Challenge,{" "}
          <a className="underline" href="https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/">
            Lunar Landing Site Navigator
          </a>
          . Lunario combines Rian’s original identity and loading sequence with the lunar mission workbench. This tool is not a NASA
          operational product, and it does not fly hardware or schedule the Deep Space Network.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl">How a result is made</h2>
        <p>
          On a smooth sphere, south-polar sites are in sunlight about half the time. The Sun only climbs
          about 1.5° above the lunar equator, so a flat horizon near the pole is a coin flip stretched over
          the year. The places called peaks of near-eternal light — sometimes sunlit more than 80% of the
          time in published maps — get that extra light from terrain. A ridge looks downhill, past the
          geometric horizon, and still sees the Sun when a plain is dark. A crater does the opposite.
        </p>
        <p>
          Every number in the app is shown two ways: <strong>with LOLA terrain</strong> and on a{" "}
          <strong>smooth sphere</strong>. The difference is the terrain.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            JPL Horizons (DE441) supplies the sub-solar point, the sub-Earth point, the Earth–Moon range,
            and the Sun&apos;s angular diameter, hourly from 1 January 2026 through 1 January 2028.
          </li>
          <li>
            Azimuth and elevation at a site are ordinary spherical astronomy. Earth includes lunar parallax,
            because Earth is close enough that a south-polar observer and the Moon&apos;s center do not see
            it in the same place. The Sun&apos;s parallax is negligible.
          </li>
          <li>
            Those angles were checked against Horizons&apos; own topocentric observer tables at every catalog
            site. Largest absolute difference in this build: Sun elevation {v.maxAbsSunElevationDeg}°, Sun
            azimuth {v.maxAbsSunAzimuthDeg}°, Earth elevation {v.maxAbsEarthElevationDeg}°, Earth azimuth{" "}
            {v.maxAbsEarthAzimuthDeg}°, over {v.samples} samples.
          </li>
          <li>
            The terrain horizon is a ray march on LOLA elevation. {catalog.meta.demFine} inside its footprint,
            and {catalog.meta.demCoarse} where a ray leaves that footprint. Both are south-polar stereographic
            mosaics on the 1737.4 km sphere in the MOON_ME frame, the same frame Horizons calls MEAN_ME.
          </li>
          <li>
            A catalog site is marched every 1° of azimuth, with steps of 40 m nearby, then 160 m, then 400 m,
            out to 250 km. The observer sits 0, 2, or 10 m above the local surface. Custom points use the
            nearest cell of a coarser grid (every 3° of azimuth, 2 m only).
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl">What is measured</h2>
        <p>
          <strong>Sunlit</strong> means any part of the solar disk is above the horizon. The disk is treated
          as uniform, and the horizon is treated as straight across the Sun&apos;s half-degree width.{" "}
          <strong>Relative solar exposure</strong> is the average lit fraction of that disk. It is not watts.
          South-polar arrays stand nearly upright and turn to face the Sun, so the first question is whether
          the Sun clears the terrain, not the elevation above a horizontal panel.
        </p>
        <p>
          <strong>Earth in view</strong> means the center of Earth is above the terrain horizon. A second,
          more generous test asks whether any part of Earth&apos;s disk clears the horizon, using a spherical
          Earth of radius 6,378.137 km. That second test matches the spirit of the PGDA Earth-visibility maps,
          and it is slightly optimistic for a link to one ground station. This app does not model which Deep
          Space Network complex is on the facing hemisphere.
        </p>
        <p>
          The longest dark period counts consecutive hourly samples with no solar disk above the horizon.
          An edge can be off by up to an hour.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl">A check against a known height</h2>
        <p>
          NASA reported the IM-1 Odysseus resting place at 80.13°S, 1.44°E and 2,579 m. The LOLA sample at
          that coordinate in this build is{" "}
          {v.odysseusLolaHeightM == null ? "unavailable" : `${v.odysseusLolaHeightM} m`}. Agreement here is a
          check that the map is pinned to the same Moon, not a claim about illumination.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl">Sources</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <a className="underline" href="https://ssd.jpl.nasa.gov/horizons/">NASA JPL Horizons</a>, DE441,
            API <code>ssd.jpl.nasa.gov/api/horizons.api</code>. Sun, Earth, and the Moon&apos;s orientation.
          </li>
          <li>
            <a className="underline" href="https://pgda.gsfc.nasa.gov/products/90">LOLA south-polar DEMs</a>{" "}
            on the NASA GSFC Planetary Geodesy Data Archive (Barker et al.). Files {catalog.meta.demFine} and{" "}
            {catalog.meta.demCoarse}.
          </li>
          <li>
            <a className="underline" href="https://pgda.gsfc.nasa.gov/products/69">PGDA product 69</a> (Mazarico
            et al.) is the long-run illumination and Earth-visibility atlas this kind of question comes from.
            Those maps average 18.6 years. This app recomputes 2026–2027 from the topography and Horizons,
            so the percentages will not match product 69 exactly, and they should not be pasted in as if they did.
          </li>
          <li>
            Site coordinates are cited on each place: LROC for Malapert Massif and IM-2 Athena, NASA for IM-1
            Odysseus, LPSC abstracts for Connecting Ridge, Peak Near Shackleton, and the de Gerlache–Shackleton
            ridge, and Marshall et al. (2012) for the LCROSS Centaur impact. The Shackleton rim crest, when
            present, is a LOLA sample chosen by this pipeline, not a NASA pin.
          </li>
          <li>
            Related viewers, not used as live data:{" "}
            <a className="underline" href="https://trek.nasa.gov/moon/">NASA Moon Trek</a> and{" "}
            <a className="underline" href="https://quickmap.lroc.asu.edu/">LROC QuickMap</a>.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl">Limitations</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>{catalog.meta.samplingNote}</li>
          <li>{catalog.meta.gridNote}</li>
          <li>
            The map lighting wash is a coarse grid, about 1° of latitude by 2° of longitude, using the same
            2 m horizon masks as custom points and a 3° azimuth step. Each cell is sunlit when any part of
            the solar disk from JPL Horizons clears that horizon. It is not a shadow cast for every 40 m
            pixel of the hillshade. The oblique view is a 2D sky-dome sketch, not a three-dimensional terrain model.
          </li>
          <li>
            The series is two years, not the 18.6-year nodal cycle. A crest that is sunlit 86% in a
            multi-year atlas can read lower or higher in 2026–2027.
          </li>
          <li>
            A 40 m elevation model smooths ridges that are only a few meters wide. Published peaks above
            80% often come from finer maps, or from a solar array several meters up on the exact crest.
            If this app does not show a site above 80%, that is a limit of the sampling, not a claim that
            such ground does not exist.
          </li>
          <li>
            Local rocks, lander tilt, dust on arrays, and array pointing are not modeled. IM-1 and IM-2
            both came to rest on their sides; the scores here are for an upright observer at the coordinate,
            not a reconstruction of those landings.
          </li>
          <li>
            Slope is a finite difference over about 40 m. It is not a landing-safety certification.
          </li>
          <li>
            Horizons times after the last published leap second use that leap second as a constant. The
            header of a Horizons table says so. It does not move the Sun by a meaningful angle at this
            cadence.
          </li>
          <li>There is no atmosphere and no refraction. Horizons was queried that way too.</li>
        </ul>
        <p className="text-muted-foreground">
          Catalog generated {catalog.meta.generatedUtc}. Frame: {catalog.meta.frame}.
        </p>
      </section>
    </article>
  );
}
