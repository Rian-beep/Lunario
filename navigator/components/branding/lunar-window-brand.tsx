import type { ReactNode } from "react";
import { LUNARIO_WORDMARK } from "./lunario-vendor.generated";
import "./branding.css";

export type LunarWindowBrandProps = { icon?: ReactNode };

/** Legacy call signature retained; the upstream SVG contains its own mark. */
export function LunarWindowBrand(props: LunarWindowBrandProps = {}) {
  void props.icon;
  // A data URI preserves the original outlined SVG in the disconnected bundle.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="lunario-wordmark" src={LUNARIO_WORDMARK} alt="Lunario" width={303} height={64} />;
}
