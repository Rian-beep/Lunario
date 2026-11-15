import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { resolveSiteShellNav } from "../lib/site-shell-nav";

test("offline HTML under navigator/public resolves Dashboard and About to the site root", () => {
  const nav = resolveSiteShellNav(
    "/Lunario/navigator/public/solarreach-navigator.html",
    "https://rian-beep.github.io/Lunario/navigator/public/solarreach-navigator.html",
  );
  assert.equal(nav.dashboardHref, "https://rian-beep.github.io/Lunario/");
  assert.equal(nav.aboutHref, "https://rian-beep.github.io/Lunario/about.html");
  assert.equal(nav.current, "dashboard");
});

test("navigator header mounts cream site shell links beside the brand", () => {
  const source = readFileSync(join(process.cwd(), "components/navigator.tsx"), "utf8");
  assert.match(source, /SiteShellNavLinks/);
  assert.match(source, /header-brand-cluster/);
});

test("Dashboard page drops the dark double nav shell", () => {
  const index = readFileSync(join(process.cwd(), "../index.html"), "utf8");
  assert.doesNotMatch(index, /<header class="nav">/);
  assert.match(index, /dash-page/);
  assert.match(index, /navigator-frame/);
});
