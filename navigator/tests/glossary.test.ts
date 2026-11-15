import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { GLOSSARY, glossaryFor } from "../lib/glossary";
import { chartLabels } from "../lib/charts";

test("all existing NumberField, Metric and static Info labels have complete explanations", () => {
  const labels = new Set<string>();
  for (const path of [
    "components/workbench/controls.tsx",
    "components/workbench/panels.tsx",
    "components/navigator.tsx",
    "components/workbench/decision-panel.tsx",
    "components/workbench/sensitivity-panel.tsx",
    "components/workbench/mission-calendar.tsx",
  ]) {
    const source = ts.createSourceFile(
      path,
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        ["NumberField", "Metric", "Info"].includes(node.tagName.getText(source))
      ) {
        for (const prop of node.attributes.properties)
          if (
            ts.isJsxAttribute(prop) &&
            prop.name.getText(source) === "label" &&
            prop.initializer &&
            (ts.isStringLiteral(prop.initializer) || ts.isJsxExpression(prop.initializer))
          ) {
            const collect = (value: ts.Node) => {
              if (ts.isStringLiteral(value)) labels.add(value.text);
              else if (ts.isJsxExpression(value) && value.expression) collect(value.expression);
              else if (ts.isConditionalExpression(value)) { collect(value.whenTrue); collect(value.whenFalse); }
            };
            collect(prop.initializer);
          }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(
    labels.size >= 35,
    "inspect real controls, rather than silently testing an empty match",
  );
  for (const label of labels) {
    const entry = glossaryFor(label);
    assert.ok(entry, `Missing help: ${label}`);
    for (const [kind, text] of Object.entries(entry))
      assert.ok(text.trim().length > 25, `${label}: ${kind} is incomplete`);
  }
});

test("dynamic radio inputs and comparison columns are covered from actual panel declarations", () => {
  const path = "components/workbench/panels.tsx",
    text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "COLUMNS" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties)
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isStringLiteral(prop.initializer)
        )
          labels.add(prop.initializer.text);
    }
    if (
      ts.isArrayLiteralExpression(node) &&
      node.elements.length === 3 &&
      node.elements.every(ts.isStringLiteral)
    ) {
      const [key, label] = node.elements;
      if (
        ts.isStringLiteral(key) &&
        ts.isStringLiteral(label) &&
        /^(frequencyGHz|rangeKm|txPowerW|txGainDbi|rxGainDbi|lossDb|noiseTempK|dataRateBps|requiredEbN0Db)$/.test(
          key.text,
        )
      )
        labels.add(label.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const required of ["Assessment outcome", "First known failure UTC", "Required unknowns", "Dataset version", "Model version", "Reserve margin Wh", "Known solar coverage %"])
    assert.ok(labels.has(required), `Comparison metadata column is absent from the source audit: ${required}`);
  assert.ok(labels.size >= 29, "audit existing radio inputs and expanded comparison declarations");
  for (const label of labels)
    assert.ok(glossaryFor(label), `Missing dynamic help: ${label}`);
});

test("each visible chart axis resolves to help for every audience", () => {
  for (const audience of ["public", "teach", "plan"] as const)
    for (const kind of [
      "horizon",
      "elevation",
      "flight",
      "power",
      "battery",
    ] as const) {
      const { x, y } = chartLabels(kind, audience);
      assert.ok(glossaryFor(x), `No explanation for ${x}`);
      assert.ok(glossaryFor(y), `No explanation for ${y}`);
    }
  assert.ok(glossaryFor("Speed (m/s)"));
});

test("physical liftoff condition is necessary, with initial mass, gravity and pitch stated", () => {
  const thrust = glossaryFor("Thrust")!;
  assert.match(thrust.range, /T\/W > 1.*necessary.*not a success/);
  assert.match(thrust.technical, /m₀.*r₀².*initial altitude/);
  assert.match(thrust.technical, /sin\(pitch\)/);
  assert.match(thrust.technical, /g₀.*not lunar gravity/);
  assert.match(glossaryFor("Initial thrust / weight")!.range, /not sufficient/);
});

test("glossary describes the implemented fixed flux, centre incidence, sampling and unknowns", () => {
  assert.match(
    glossaryFor("Incident flux")!.technical,
    /does not automatically scale/,
  );
  assert.match(
    glossaryFor("Array orientation")!.technical,
    /Sun centre.*not disk-integrated/,
  );
  assert.match(
    glossaryFor("Minimum antenna elevation")!.technical,
    /strictly exceed max/,
  );
  assert.match(
    glossaryFor("Minimum battery")!.technical,
    /initial charge.*interval-end.*unknown/,
  );
  assert.match(
    glossaryFor("Time in sunlight")!.technical,
    /both Sun and Earth.*unknown samples are excluded/,
  );
  assert.match(
    glossaryFor("Height above surface (km)")!.intuition,
    /not terrain clearance/,
  );
});

test("critical limits remain vehicle- or mission-specific and do not imply certification", () => {
  assert.match(
    glossaryFor("Surface slope")!.range,
    /lander-specific.*cannot certify/,
  );
  assert.match(
    glossaryFor("Speed (m/s)")!.range,
    /vehicle-specific.*No universal/,
  );
  assert.match(
    glossaryFor("Reserve threshold")!.range,
    /mission requirement.*not a NASA universal/,
  );
  assert.match(
    glossaryFor("Link margin")!.range,
    /mission-specific.*no universal.*certification/,
  );
  for (const [label, entry] of Object.entries(GLOSSARY)) {
    assert.ok(
      entry.intuition && entry.teaching && entry.technical && entry.range,
      label,
    );
  }
  assert.equal(glossaryFor("unrecognised custom metric"), undefined);
});

test("every named plotted variable has adjacent glossary support", () => {
  const path = "components/workbench/science-charts.tsx";
  const source = ts.createSourceFile(
    path,
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const labels = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) && p.name.getText(source) === "points",
      )
    ) {
      for (const prop of node.properties)
        if (
          ts.isPropertyAssignment(prop) &&
          prop.name.getText(source) === "name" &&
          ts.isStringLiteral(prop.initializer)
        )
          labels.add(prop.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(labels.size >= 16);
  for (const label of labels)
    assert.ok(
      glossaryFor(label),
      `No explanation for plotted variable ${label}`,
    );
  assert.equal(glossaryFor("toString"), undefined);
  assert.equal(glossaryFor("__proto__"), undefined);
});


test("planning help distinguishes rates, relative schedules, independent heights and finite sensitivity", () => {
  assert.match(glossaryFor("Maximum charging power")!.technical, /bus W.*before charge efficiency/);
  assert.match(glossaryFor("Maximum discharging power")!.technical, /divided by discharge efficiency/);
  assert.match(glossaryFor("Battery rate limit")!.technical, /null.*unlimited.*zero/);
  assert.match(glossaryFor("Load start offset")!.technical, /half-open.*overlapping/);
  assert.match(glossaryFor("Contact end offset")!.technical, /Exclusive end.*unknown overlap/);
  assert.match(glossaryFor("Solar-array height (m)")!.teaching, /antenna-height.*independent/);
  assert.match(glossaryFor("Known solar coverage %")!.technical, /coverage, not.*illuminated/);
  assert.match(glossaryFor("Sensitivity")!.teaching, /not the probability/);
  assert.match(glossaryFor("Initial stored fraction (0–1)")!.technical, /0 to 1/);
  assert.match(glossaryFor("Array deployment delay")!.technical, /generation is zero before deployment/);
});

test("dynamic sensitivity choices and assessment row help have explicit semantic coverage", () => {
  const path="components/workbench/sensitivity-panel.tsx";
  const source=ts.createSourceFile(path,readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const choices=new Map<string,string>();
  const visit=(node:ts.Node)=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="fields"&&node.initializer&&ts.isObjectLiteralExpression(node.initializer))
      for(const prop of node.initializer.properties) if(ts.isPropertyAssignment(prop)&&ts.isStringLiteral(prop.initializer)) choices.set(prop.name.getText(source),prop.initializer.text);
    ts.forEachChild(node,visit);
  };visit(source);
  for(const field of ["arrivalOffsetHours","loadMultiplier","batteryWh","initialSoc","arrayHeightM","antennaHeightM"]) assert.ok(choices.has(field),`Sensitivity axis omitted from audit: ${field}`);
  for(const label of choices.values()) assert.ok(glossaryFor(label),`Missing sensitivity help: ${label}`);
  for(const label of ["Stored energy reserve","Unserved electrical demand","Maximum geometric Earth outage","Assumed free-space radio margin"])
    assert.ok(glossaryFor(label),`Missing dynamic assessment-row help: ${label}`);
});

test("named contact requirements and additional screens resolve without accepting arbitrary custom metrics",()=>{
 assert.ok(glossaryFor("Critical Earth visibility: arrival-contact"));
 for(const key of ["minSunFraction","minContactFraction","maxDarkHours","maxBlackoutHours","maxSlopeDeg","minBatteryWh","maxUnmetWh"]) assert.ok(glossaryFor(`Additional screen: ${key}`));
 assert.equal(glossaryFor("Additional screen: inventedSafetyScore"),undefined);
});
