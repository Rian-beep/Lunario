import { test } from "node:test";
import assert from "node:assert/strict";
import catalogue from "../public/data/stars.json";
import { BRIGHT_STARS, moonFixedStarDirection, starDirectionJ2000, type Star } from "../lib/stars";

const star = (raDeg: number, decDeg = 0): Star => ({ id: "axis", name: "Analytic axis", raDeg, decDeg, magnitude: 0 });
const close = (actual: number, expected: number, tolerance = 2e-11) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);

// Generated independently with SpiceyPy 8.4.0 / CSPICE_N0067:
// furnsh(pck00011.tpc), furnsh(naif0012.tls), pxform("J2000", "IAU_MOON", str2et(utc)).
// Kernel byte hashes and reproduction command are recorded in docs/STARS.md.
const CSPICE_REFERENCE = [
  {
    "utc": "1972-01-01T00:00:00Z",
    "matrix": [
      [
        0.12399651858382157,
        -0.9154316378577193,
        -0.3828965653910016
      ],
      [
        0.9920481028839127,
        0.12275559694300997,
        0.027778138591259185
      ],
      [
        0.021573709544765535,
        -0.3832962037749642,
        0.9233734863142753
      ]
    ]
  },
  {
    "utc": "2000-01-01T12:00:00Z",
    "matrix": [
      [
        0.7841211000509216,
        0.5579701954550914,
        0.27170454806414235
      ],
      [
        -0.6201958954890484,
        0.7204613166872191,
        0.31031039682204653
      ],
      [
        -0.022608663681653554,
        -0.4118309752084291,
        0.9109797452113874
      ]
    ]
  },
  {
    "utc": "2016-12-31T23:59:59Z",
    "matrix": [
      [
        -0.7305847655042964,
        0.6227094704151217,
        0.28014070726752804
      ],
      [
        -0.6827419354227336,
        -0.6599062210100329,
        -0.3136673860755646
      ],
      [
        -0.010457056385618058,
        -0.4204244223728875,
        0.9072673007687271
      ]
    ]
  },
  {
    "utc": "2017-01-01T00:00:00Z",
    "matrix": [
      [
        -0.7305884001547334,
        0.6227059578880187,
        0.28013903614118496
      ],
      [
        -0.6827380460722643,
        -0.6599095374049854,
        -0.31366887459128767
      ],
      [
        -0.010457055263016742,
        -0.42042441942958464,
        0.907267302145582
      ]
    ]
  },
  {
    "utc": "2026-01-01T00:00:00Z",
    "matrix": [
      [
        -0.3807463766342999,
        -0.858528316033752,
        -0.34345498576684247
      ],
      [
        0.9246427996791954,
        -0.3501841972430953,
        -0.14968874708082883
      ],
      [
        0.00823951948060572,
        -0.3745666276771851,
        0.927163389996213
      ]
    ]
  },
  {
    "utc": "2026-11-14T12:00:00Z",
    "matrix": [
      [
        -0.3599910067082967,
        0.8620536488567465,
        0.3567491858181549
      ],
      [
        -0.9328281225761641,
        -0.3389124802628598,
        -0.12235205128278685
      ],
      [
        0.01543271914395255,
        -0.3768313113514401,
        0.9261533317788032
      ]
    ]
  },
  {
    "utc": "2028-01-01T00:00:00Z",
    "matrix": [
      [
        -0.8323041246282624,
        0.5042024113216028,
        0.23032536235565323
      ],
      [
        -0.5538471770820291,
        -0.7735543703877595,
        -0.3080047734894125
      ],
      [
        0.022872441169434002,
        -0.3839186951315057,
        0.9230835752863729
      ]
    ]
  }
];

test("embedded subset retains source, licence, epoch, bounded count and valid unique records", () => {
  assert.equal(BRIGHT_STARS.length, 523);
  assert.equal(catalogue.meta.count, BRIGHT_STARS.length);
  assert.equal(catalogue.meta.license, "CC-BY-SA-4.0");
  assert.match(catalogue.meta.epoch, /2000/);
  assert.match(catalogue.meta.sourceUrl, /astronexus\/HYG-Database\/[a-f0-9]{40}\//);
  assert.equal(new Set(BRIGHT_STARS.map((s) => s.id)).size, BRIGHT_STARS.length);
  for (const s of BRIGHT_STARS) {
    assert.match(s.id, /^HYG:[1-9][0-9]*$/);
    assert.ok(s.name.trim().length > 0);
    assert.ok(s.raDeg >= 0 && s.raDeg < 360 && Number.isFinite(s.raDeg));
    assert.ok(Math.abs(s.decDeg) <= 90 && Number.isFinite(s.decDeg));
    assert.ok(Number.isFinite(s.magnitude) && s.magnitude <= 4);
  }
  assert.ok(Object.isFrozen(BRIGHT_STARS));
  assert.ok(BRIGHT_STARS.every(Object.isFrozen));
});

test("Sirius preserves published HYG identity, hour-to-degree conversion and apparent V magnitude", () => {
  const sirius = BRIGHT_STARS.find((s) => s.name === "Sirius");
  assert.ok(sirius);
  assert.equal(sirius.id, "HYG:32263");
  close(sirius.raDeg, 6.752481 * 15);
  assert.equal(sirius.decDeg, -16.716116);
  assert.equal(sirius.magnitude, -1.44);
  assert.equal(BRIGHT_STARS[0], sirius);
});

test("J2000 directions use equinox X, RA90 Y and north Z in a right-handed system", () => {
  const axes = [[0, 0, [1, 0, 0]], [90, 0, [0, 1, 0]], [180, 0, [-1, 0, 0]],
    [270, 0, [0, -1, 0]], [0, 90, [0, 0, 1]], [123, -90, [0, 0, -1]]] as const;
  for (const [ra, dec, expected] of axes) {
    starDirectionJ2000(star(ra, dec)).forEach((value, i) => close(value, expected[i]));
  }
});

test("catalogue directions remain unit length in both frames", () => {
  for (const s of BRIGHT_STARS) {
    close(Math.hypot(...starDirectionJ2000(s)), 1);
    for (const utc of ["2026-01-01T00:00:00Z", "2026-11-14T12:00:00Z", "2028-01-01T00:00:00Z"]) {
      close(Math.hypot(...moonFixedStarDirection(s, Date.parse(utc))), 1);
    }
  }
});

for (const { utc, matrix } of CSPICE_REFERENCE) {
  test(`IAU_MOON matches independent CSPICE matrix at ${utc}`, () => {
    for (const [column, axis] of [star(0), star(90), star(0, 90)].entries()) {
      moonFixedStarDirection(axis, Date.parse(utc)).forEach((value, row) => close(value, matrix[row][column]));
    }
  });
}

test("Moon rotation preserves pair angles, orthogonality and handedness", () => {
  const epoch = Date.parse("2026-11-14T12:00:00Z");
  const [x, y, z] = [star(0), star(90), star(0, 90)].map((s) => moonFixedStarDirection(s, epoch));
  close(dot(x, y), 0); close(dot(x, z), 0); close(dot(y, z), 0);
  const cross = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  cross.forEach((value, i) => close(value, z[i]));
  const a = star(12, -47), b = star(231, 16);
  close(dot(starDirectionJ2000(a), starDirectionJ2000(b)), dot(moonFixedStarDirection(a, epoch), moonFixedStarDirection(b, epoch)));
});

test("non-axis stars match independent matrix multiplication without input mutation", () => {
  const { utc, matrix } = CSPICE_REFERENCE[5];
  for (const s of BRIGHT_STARS.slice(0, 20)) {
    const before = { ...s }, inertial = starDirectionJ2000(s);
    const expected = matrix.map((row) => dot(row, inertial));
    moonFixedStarDirection(s, Date.parse(utc)).forEach((value, i) => close(value, expected[i]));
    assert.deepEqual(s, before);
  }
});

test("invalid coordinates reject instead of silently producing a sky direction", () => {
  for (const s of [star(NaN), star(Infinity), star(-1), star(360), star(0, NaN), star(0, Infinity), star(0, -91), star(0, 91)]) {
    assert.throws(() => starDirectionJ2000(s), RangeError);
    assert.throws(() => moonFixedStarDirection(s, Date.parse("2026-01-01T00:00:00Z")), RangeError);
  }
});

test("invalid dates and pre-1972 epochs reject outside the available UTC conversion", () => {
  for (const epoch of [NaN, Infinity, -Infinity, 8.64e15 + 1, Date.parse("1972-01-01T00:00:00Z") - 1]) {
    assert.throws(() => moonFixedStarDirection(star(0), epoch), RangeError);
  }
});
