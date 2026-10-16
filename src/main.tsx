import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyTheme } from "./lib/theme";
import { selectedTheme, useThemeStore } from "./stores/useThemeStore";

applyTheme(selectedTheme(useThemeStore.getState()));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
