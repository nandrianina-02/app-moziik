#!/usr/bin/env node
/**
 * Obtient un jeton de rafraîchissement, une fois.
 *
 * Pourquoi ce détour plutôt que de mettre le mot de passe dans la
 * configuration du client MCP : le jeton se révoque depuis « Mon compte »,
 * page des appareils connectés, sans toucher au mot de passe ni aux autres
 * sessions. Si la configuration fuite, on coupe ce seul accès.
 *
 *   node src/jeton.js                    (demande les identifiants)
 *   MOZIIK_EMAIL=... MOZIIK_PASSWORD=... node src/jeton.js
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { ClientMoziik, ErreurMoziik } from "./moziik.js";

async function demander(question, masque = false) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    if (!masque) return (await rl.question(question)).trim();

    // Masquage du mot de passe : on intercepte l'écho du terminal. Sans
    // cela, il reste lisible à l'écran et dans l'historique de la console.
    const ecrire = stdout.write.bind(stdout);
    let demarre = false;
    stdout.write = (chunk, ...reste) => {
      if (demarre) return true;
      return ecrire(chunk, ...reste);
    };
    const promesse = rl.question(question);
    demarre = true;
    const valeur = await promesse;
    stdout.write = ecrire;
    ecrire("\n");
    return valeur.trim();
  } finally {
    rl.close();
  }
}

const base = (process.env.MOZIIK_URL ?? "https://app-moziik.vercel.app").replace(/\/+$/, "");

const email = process.env.MOZIIK_EMAIL ?? (await demander(`Email du compte Moziik (${base}) : `));
const motDePasse = process.env.MOZIIK_PASSWORD ?? (await demander("Mot de passe : ", true));

if (!email || !motDePasse) {
  console.error("Identifiants incomplets.");
  process.exit(1);
}

try {
  const res = await fetch(`${base}/api/mobile-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse, device: "Moziik Admin MCP" }),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error(`Connexion refusée : ${(data && data.error) || res.status}`);
    process.exit(1);
  }

  const client = new ClientMoziik({ base, refreshToken: data.refreshToken });
  const moi = await client.moi();

  console.log("");
  console.log(`Compte   : ${moi.name ?? email} (${moi.role ?? "role inconnu"})`);
  console.log(`Serveur  : ${base}`);
  console.log("");
  console.log("Ajoutez ceci à la configuration de votre client MCP :");
  console.log("");
  console.log(`  "MOZIIK_URL": ${JSON.stringify(base)},`);
  console.log(`  "MOZIIK_REFRESH_TOKEN": ${JSON.stringify(data.refreshToken)}`);
  console.log("");
  console.log("Ce jeton vaut trente jours et se révoque depuis Mon compte,");
  console.log("section des appareils connectés.");

  if (moi.role !== "admin") {
    console.log("");
    console.log(
      `Attention : ce compte a le rôle « ${moi.role} ». Les outils d'administration ` +
        "seront refusés par le serveur — c'est lui qui décide, pas ce programme."
    );
  }
} catch (err) {
  const message = err instanceof ErreurMoziik ? err.message : String(err && err.message ? err.message : err);
  console.error(`Échec : ${message}`);
  process.exit(1);
}
