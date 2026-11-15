import { createRoot } from "react-dom/client";
import { Navigator } from "../components/navigator";
import { updateLunarioStartup } from "../components/branding/lunario-loader-runtime";
import { publicAssetURL } from "../lib/public-assets";
import "../app/mission-theme.css";
import "../app/lunario-fonts.css";
import "./fonts.css";

// Also available to same-origin parent adapters without rewriting source metadata.
globalThis.__LUNARIO_PUBLIC_ASSET_URL__ = publicAssetURL;
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
// Navigator reuses this document-owned original loader, including its 3s minimum.
updateLunarioStartup(document, false);
createRoot(root).render(<Navigator />);
