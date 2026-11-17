import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { appliquerTheme, themeEnregistre } from "./theme";
import "./styles.css";

// Avant le premier rendu : sans quoi l'interface clignote en sombre au
// lancement chez qui a choisi le thème clair.
appliquerTheme(themeEnregistre());

createRoot(document.getElementById("racine")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
