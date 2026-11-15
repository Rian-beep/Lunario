import { createRoot } from "react-dom/client";
import { Navigator } from "../components/navigator";
import "../app/mission-theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<Navigator />);
