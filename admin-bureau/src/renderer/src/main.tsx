import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { appliquerPreferences } from "./preferences";
import { essaiEncodage } from "./essai";
import "./styles.css";

// Avant le premier rendu : sans quoi l'interface clignote en sombre au
// lancement chez qui a choisi le thème clair, ou change de taille.
appliquerPreferences();

// Mode d'essai de l'intégration continue (voir essaiReseau dans le
// processus principal) : pas d'interface, seulement le résultat dans le titre.
if (new URLSearchParams(location.search).get("essai") === "encodage") {
  void essaiEncodage();
} else {
  createRoot(document.getElementById("racine")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
