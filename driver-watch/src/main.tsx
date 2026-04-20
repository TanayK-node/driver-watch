import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const redirectPath = new URLSearchParams(window.location.search).get("path");

if (redirectPath) {
	window.history.replaceState(null, "", decodeURIComponent(redirectPath));
}

createRoot(document.getElementById("root")!).render(<App />);
