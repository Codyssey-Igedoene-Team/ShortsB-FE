import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { readLocation } from "./app/routes";
import "./styles.css";
const root = document.getElementById("root")!;
const bootstrap = document.getElementById("shortb-bootstrap");
if (bootstrap) {
  const data = JSON.parse(bootstrap.textContent || "{}");
  hydrateRoot(root, <App {...data} />);
} else createRoot(root).render(<App initialLocation={readLocation()} />);
