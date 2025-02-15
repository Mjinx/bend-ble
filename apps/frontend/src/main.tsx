import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";

const rootElement = document.getElementById("root");

if (rootElement == null) {
  throw new Error("Could not find root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
