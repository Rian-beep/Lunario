/** Resolve Dashboard / About URLs for the site shell from Next, offline HTML, or a Pages iframe. */
export type SiteShellNav = {
  dashboardHref: string;
  aboutHref: string;
  current: "dashboard" | "about" | "app";
};

export function resolveSiteShellNav(
  pathname = typeof window === "undefined" ? "/navigator/public/solarreach-navigator.html" : window.location.pathname,
  href = typeof window === "undefined" ? "http://local/navigator/public/solarreach-navigator.html" : window.location.href,
): SiteShellNav {
  const underNavigatorPublic =
    /solarreach-navigator\.html$/i.test(pathname) || /\/navigator\/public(?:\/|$)/i.test(pathname);

  if (underNavigatorPublic) {
    const siteRoot = new URL("../../", href);
    return {
      dashboardHref: new URL("./", siteRoot).href,
      aboutHref: new URL("about.html", siteRoot).href,
      current: "dashboard",
    };
  }

  if (/\/navigator(?:\/|$)/i.test(pathname)) {
    // pathname like /navigator or /navigator/foo → parent of /navigator/
    const navIdx = pathname.indexOf("/navigator");
    const rootPath = navIdx >= 0 ? pathname.slice(0, navIdx + 1) : "/";
    const root = new URL(rootPath, href);
    return {
      dashboardHref: root.href,
      aboutHref: new URL("about.html", root).href,
      current: "dashboard",
    };
  }

  return {
    dashboardHref: "./",
    aboutHref: "about.html",
    current: "dashboard",
  };
}
