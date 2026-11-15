import { LUNARIO_LOADER_CSS, LUNARIO_LOADER_JS } from "./lunario-vendor.generated";

export interface LunarioLoaderAPI {
  hide(): Promise<void>;
  show(): Promise<void>;
  ready: Promise<void>;
  skipped?: boolean;
}

type LunarioWindow = Window & { Lunario?: { loader?: LunarioLoaderAPI } };
type StartupState = { hideRequested: boolean; loader?: LunarioLoaderAPI };
const DOCUMENT_STATE = Symbol.for("lunario.startup.vendor");
type StartupDocument = Document & { [DOCUMENT_STATE]?: StartupState };

/** Document-owned: React branch changes and Strict Mode must never replay the vendor. */
export function updateLunarioStartup(document: Document, ready: boolean): Promise<void> | undefined {
  const owner = document as StartupDocument;
  const view = document.defaultView as LunarioWindow | null;
  if (!view || !document.body) return;
  let state = owner[DOCUMENT_STATE];
  if (!state) {
    state = { hideRequested: false };
    owner[DOCUMENT_STATE] = state;
    const style = document.createElement("style");
    style.dataset.lunarioVendor = "loader";
    style.textContent = LUNARIO_LOADER_CSS;
    document.head.appendChild(style);
    const script = document.createElement("script");
    script.dataset.lunarioVendor = "loader";
    script.dataset.autoHide = "false";
    script.dataset.once = "session";
    script.dataset.altitude = "0";
    script.textContent = LUNARIO_LOADER_JS;
    document.body.appendChild(script);
    state.loader = view.Lunario?.loader;
  }
  if (ready && !state.hideRequested) {
    state.hideRequested = true;
    void state.loader?.hide();
  }
  return state.loader?.ready;
}
