import type { ReactNode } from "react";
import { LunarWindowBrand } from "./lunar-window-brand";
import "./branding.css";

export { LunarioStartup, type LunarioStartupProps } from "./lunario-startup";

export type LunarWindowLoaderProps = { icon?: ReactNode };

/** Static shell behind the document-owned original overlay while the catalog loads. */
export function LunarWindowLoader({ icon }: LunarWindowLoaderProps) {
  return <main className="startup lunar-window-startup" aria-busy="true">
    <div className="lunario-loading-fallback">
      <h1><LunarWindowBrand icon={icon} /></h1>
      <p role="status">Prepare for landing</p>
    </div>
  </main>;
}
