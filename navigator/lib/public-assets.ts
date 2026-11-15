declare global {
  // Hosted entry only. Next and the embedded offline entry leave this unset.
  var __LUNARIO_PUBLIC_BASE__: string | undefined;
  var __LUNARIO_PUBLIC_ASSET_URL__: typeof publicAssetURL | undefined;
}

/** Resolve transport at the I/O boundary; metadata and cache identities stay canonical. */
export function publicAssetURL(canonicalPath: string): string {
  if (typeof canonicalPath !== "string" || !canonicalPath) {
    throw new Error("Invalid public asset path");
  }
  if (/^(https?:|data:|blob:)/i.test(canonicalPath) || canonicalPath.startsWith("//")) {
    if (!/^(data:|blob:)/i.test(canonicalPath)) new URL(canonicalPath, "https://localhost/");
    return canonicalPath;
  }
  if (!canonicalPath.startsWith("/") || /[\\:%?#\s\u0000-\u001f\u007f]/.test(canonicalPath) ||
      canonicalPath.slice(1).split("/").some((part, index, parts) => part === "." || part === ".." || (!part && index !== parts.length - 1))) {
    throw new Error("Expected a canonical root-relative public asset path");
  }
  const configured = globalThis.__LUNARIO_PUBLIC_BASE__;
  if (configured === undefined) return canonicalPath;
  if (typeof configured !== "string" || !configured || !configured.endsWith("/") || /[\\%?#\s\u0000-\u001f\u007f]/.test(configured) || configured.startsWith("//") ||
      (/^[a-z][a-z0-9+.-]*:/i.test(configured) && !/^https?:\/\//i.test(configured))) {
    throw new Error("Public asset base must be a safe same-origin HTTP(S) directory");
  }
  if (typeof document === "undefined") throw new Error("Public asset base requires a document URI");
  const documentURL = new URL(document.documentURI);
  // One leading parent step supports web/ alongside navigator/public/. Reject
  // traversal elsewhere before URL normalization can silently remove it.
  const relative = configured.replace(/^\.\.?\//, "");
  const base = new URL(configured, documentURL);
  if (relative.split("/").some(part => part === "." || part === "..") ||
      !["http:", "https:"].includes(base.protocol) || base.origin !== documentURL.origin ||
      base.username || base.password || base.search || base.hash || !base.pathname.endsWith("/")) {
    throw new Error("Public asset base must be a safe same-origin HTTP(S) directory");
  }
  return new URL(canonicalPath.slice(1), base).href;
}
