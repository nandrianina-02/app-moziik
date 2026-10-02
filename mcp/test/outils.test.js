/**
 * Les outils, éprouvés sans toucher à la production.
 *
 * Le client HTTP est remplacé par un double qui enregistre les appels et
 * rend des réponses décidées ici. Ce qu'on vérifie n'est donc pas que
 * Moziik répond — c'est que chaque outil appelle la BONNE route, avec les
 * bons noms de champs, et qu'il refuse ce qu'il doit refuser. C'est
 * précisément ce qu'une erreur de frappe casserait en silence.
 *
 *   node test/outils.test.js
 */

import { OUTILS, MANQUES } from "../src/outils.js";
import { ClientMoziik, ErreurMoziik, parametres } from "../src/moziik.js";

let ok = 0;
let ko = 0;
function v(nom, condition, detail) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ECHEC ${nom}${detail !== undefined ? " -- " + detail : ""}`);
  }
}

/** Double du client : note les appels, rend ce qu'on lui a dit de rendre. */
function faux(reponses = {}) {
  const appels = [];
  const repondre = (methode, route, corps) => {
    appels.push({ methode, route, corps });
    const cle = `${methode} ${route}`;
    if (cle in reponses) {
      const r = reponses[cle];
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve(r);
    }
    return Promise.resolve({});
  };
  return {
    appels,
    base: "https://exemple.test",
    configure: () => true,
    moi: () => repondre("GET", "/api/me/profile").then((r) => r.user ?? r),
    get: (r) => repondre("GET", r),
    post: (r, c) => repondre("POST", r, c),
    patch: (r, c) => repondre("PATCH", r, c),
    put: (r, c) => repondre("PUT", r, c),
    delete: (r) => repondre("DELETE", r),
  };
}

const outil = (nom) => OUTILS.find((o) => o.nom === nom);
const corpsDe = (res) => JSON.parse(res.content[0].text);

/* ------------------------------------------------------ le catalogue -- */
console.log("--- le catalogue lui-meme ---");

v("des outils sont exposes", OUTILS.length > 0, String(OUTILS.length));
v(
  "chaque outil a un nom prefixe moziik_",
  OUTILS.every((o) => /^moziik_[a-z0-9_]+$/.test(o.nom)),
  OUTILS.filter((o) => !/^moziik_[a-z0-9_]+$/.test(o.nom)).map((o) => o.nom).join(", ")
);
v("aucun nom en double", new Set(OUTILS.map((o) => o.nom)).size === OUTILS.length);
v("chaque outil se decrit", OUTILS.every((o) => o.description && o.description.length > 30));
v("chaque outil est executable", OUTILS.every((o) => typeof o.executer === "function"));
v(
  "chaque schema d entree est un objet ferme",
  OUTILS.every((o) => !o.entree || (o.entree.type === "object" && o.entree.additionalProperties === false))
);
v(
  "aucun champ requis absent de properties",
  OUTILS.every((o) => !o.entree || (o.entree.required ?? []).every((r) => r in o.entree.properties)),
  OUTILS.filter((o) => o.entree && (o.entree.required ?? []).some((r) => !(r in o.entree.properties)))
    .map((o) => o.nom)
    .join(", ")
);
v(
  "les outils destructifs sont marques",
  OUTILS.filter((o) => /supprimer/.test(o.nom)).every((o) => o.destructif === true),
  OUTILS.filter((o) => /supprimer/.test(o.nom) && !o.destructif).map((o) => o.nom).join(", ")
);
v(
  "un outil destructif n est jamais en lecture seule",
  OUTILS.every((o) => !(o.destructif && o.lectureSeule))
);
v("les manques sont documentes", Array.isArray(MANQUES) && MANQUES.length > 0);

/* ------------------------------------------------- construction d URL -- */
console.log("--- la query string ---");
v("vide quand rien n est fourni", parametres({}) === "");
v("ignore undefined et null", parametres({ a: undefined, b: null, c: "" }) === "");
v("encode", parametres({ q: "a b&c" }) === "?q=a+b%26c", parametres({ q: "a b&c" }));
v("garde le zero", parametres({ n: 0 }) === "?n=0", parametres({ n: 0 }));

/* --------------------------------------------------------- lectures -- */
console.log("--- les routes appelees ---");

{
  const c = faux({ "GET /api/songs?artist=6a8d93555facd2aa03d4d321&limit=5": { songs: [], page: 1 } });
  await outil("moziik_titres_lister").executer(c, { artiste: "6a8d93555facd2aa03d4d321", limite: 5 });
  v("titres_lister vise /api/songs", c.appels[0].route.startsWith("/api/songs?"), c.appels[0].route);
  v("titres_lister passe artist et limit", /artist=6a8d9/.test(c.appels[0].route) && /limit=5/.test(c.appels[0].route), c.appels[0].route);
}

{
  const c = faux({ "GET /api/songs/6a990b30222ebf13451f039c": { song: { _id: "x", title: "T" } } });
  await outil("moziik_titre_lire").executer(c, { id: "6a990b30222ebf13451f039c" });
  v("titre_lire vise la fiche", c.appels[0].route === "/api/songs/6a990b30222ebf13451f039c", c.appels[0].route);
}

{
  const c = faux({ "GET /api/songs/6a990b30222ebf13451f039c/lyrics": { lyrics: { synced: true, lines: [{ text: "a", startTime: 1 }], plainText: "a" } } });
  const r = corpsDe(await outil("moziik_paroles_lire").executer(c, { id: "6a990b30222ebf13451f039c" }));
  v("paroles_lire vise la bonne route", c.appels[0].route.endsWith("/lyrics"));
  v("paroles_lire compte les lignes", r.nombre_lignes === 1, String(r.nombre_lignes));
}

{
  const c = faux({ "GET /api/search?q=kaiamba&type=songs&limit=20": { results: {} } });
  await outil("moziik_rechercher").executer(c, { q: "kaiamba", type: "songs", limite: 20 });
  v("rechercher vise /api/search", c.appels[0].route.startsWith("/api/search?"), c.appels[0].route);
  v("rechercher passe q", /q=kaiamba/.test(c.appels[0].route));
}

{
  const c = faux({ "GET /api/charts?type=artists&period=month": { ranking: [] } });
  await outil("moziik_classement").executer(c, { type: "artists", periode: "month" });
  v("classement traduit periode -> period", /period=month/.test(c.appels[0].route), c.appels[0].route);
}

/* -------------------------------------------------------- ecritures -- */
console.log("--- les champs envoyes ---");

{
  const c = faux({ "PATCH /api/songs/6a990b30222ebf13451f039c": { song: { _id: "x", title: "Neuf" } } });
  await outil("moziik_titre_modifier").executer(c, {
    id: "6a990b30222ebf13451f039c",
    titre: "Neuf",
    langue: "Malagasy",
    explicite: true,
  });
  const envoye = c.appels[0].corps;
  v("titre -> title", envoye.title === "Neuf");
  v("langue -> language", envoye.language === "Malagasy");
  v("explicite -> explicit", envoye.explicit === true);
  v("rien d autre n est envoye", Object.keys(envoye).sort().join(",") === "explicit,language,title", Object.keys(envoye).join(","));
}

{
  const c = faux({});
  const r = await outil("moziik_titre_modifier").executer(c, { id: "6a990b30222ebf13451f039c" });
  v("modifier sans champ est refuse avant tout appel", r.isError === true && c.appels.length === 0);
}

{
  // Un tempo saisi doit etre marque comme manuel, sinon la prochaine
  // analyse automatique l ecraserait.
  const c = faux({ "PATCH /api/songs/6a990b30222ebf13451f039c": { song: {} } });
  await outil("moziik_titre_modifier").executer(c, { id: "6a990b30222ebf13451f039c", bpm: 128 });
  v("un bpm envoye est marque manuel", c.appels[0].corps.bpmSource === "manuel", JSON.stringify(c.appels[0].corps));
}

{
  const c = faux({ "PUT /api/songs/6a990b30222ebf13451f039c/lyrics": { lyrics: { synced: false, lines: [], plainText: "x" } } });
  await outil("moziik_paroles_ecrire").executer(c, { id: "6a990b30222ebf13451f039c", lrc: "x", credits: "Hery" });
  v("paroles_ecrire envoie raw", c.appels[0].corps.raw === "x");
  v("paroles_ecrire place les credits dans meta.by", c.appels[0].corps.meta.by === "Hery");
}

{
  const c = faux({ "PUT /api/songs/6a990b30222ebf13451f039c/lyrics": { lyrics: { synced: true, lines: [], plainText: "" } } });
  await outil("moziik_paroles_ecrire").executer(c, {
    id: "6a990b30222ebf13451f039c",
    lignes: [{ text: "a", startTime: 1.5 }],
  });
  v("paroles_ecrire envoie lines", Array.isArray(c.appels[0].corps.lines));
  v("paroles_ecrire n envoie pas raw en meme temps", c.appels[0].corps.raw === undefined);
}

{
  const c = faux({});
  const r = await outil("moziik_paroles_ecrire").executer(c, { id: "6a990b30222ebf13451f039c" });
  v("paroles_ecrire sans contenu est refuse", r.isError === true && c.appels.length === 0);
}

{
  const c = faux({ "PATCH /api/admin/artists/6a8d93555facd2aa03d4d321": { artist: {} } });
  await outil("moziik_artiste_modifier").executer(c, {
    id: "6a8d93555facd2aa03d4d321",
    nom_de_scene: "KAIAMBA",
    verifie: true,
    peut_publier_evenements: false,
  });
  const e = c.appels[0].corps;
  v("nom_de_scene -> stageName", e.stageName === "KAIAMBA");
  v("verifie -> verified", e.verified === true);
  v("peut_publier_evenements -> eventPublishingAuthorized", e.eventPublishingAuthorized === false);
}

{
  const c = faux({ "POST /api/admin/songs/6a990b30222ebf13451f039c/moderate": { song: {} } });
  await outil("moziik_titre_moderer").executer(c, { id: "6a990b30222ebf13451f039c", decision: "approve" });
  v("moderer envoie decision", c.appels[0].corps.decision === "approve");
}

{
  const c = faux({ "POST /api/ai/song-metadata": { genre: "Salegy" } });
  await outil("moziik_ia_metadonnees").executer(c, { titre: "T", langues: ["Malagasy"] });
  const e = c.appels[0].corps;
  v("ia_metadonnees envoie title et languages", e.title === "T" && Array.isArray(e.languages));
  v("artistName a un repli vide", e.artistName === "");
}

/* ---------------------------------------------------- les garde-fous -- */
console.log("--- la confirmation avant suppression ---");

{
  const c = faux({ "GET /api/songs/6a990b30222ebf13451f039c": { song: { title: "Le vrai titre" } } });
  const r = await outil("moziik_titre_supprimer").executer(c, {
    id: "6a990b30222ebf13451f039c",
    confirmation_titre: "Un autre titre",
  });
  v("un libelle qui ne correspond pas bloque", r.isError === true);
  v("et AUCUNE suppression n est partie", !c.appels.some((a) => a.methode === "DELETE"));
  v("le vrai titre est rendu pour corriger", corpsDe(r).titre_reel === "Le vrai titre");
}

{
  const c = faux({ "GET /api/songs/6a990b30222ebf13451f039c": { song: { title: "Le vrai titre" } } });
  const r = await outil("moziik_titre_supprimer").executer(c, {
    id: "6a990b30222ebf13451f039c",
    confirmation_titre: "  le VRAI   titre ",
  });
  v("la casse et les espaces sont tolerees", !r.isError, JSON.stringify(corpsDe(r)));
  v("la suppression part alors", c.appels.some((a) => a.methode === "DELETE"));
}

{
  const c = faux({ "GET /api/songs/6a990b30222ebf13451f039c": { song: {} } });
  const r = await outil("moziik_titre_supprimer").executer(c, {
    id: "6a990b30222ebf13451f039c",
    confirmation_titre: "n importe quoi",
  });
  v("un titre introuvable bloque aussi", r.isError === true && !c.appels.some((a) => a.methode === "DELETE"));
}

{
  const c = faux({ "GET /api/songs/6a990b30222ebf13451f039c": { song: { title: "T" } } });
  await outil("moziik_paroles_supprimer").executer(c, { id: "6a990b30222ebf13451f039c", confirmation_titre: "T" });
  v("paroles_supprimer vise bien /lyrics", c.appels.some((a) => a.methode === "DELETE" && a.route.endsWith("/lyrics")));
}

/* ----------------------------------------------------- les reponses -- */
console.log("--- ce qui ne doit jamais sortir ---");

{
  const c = faux({
    // Aucun parametre fourni : l outil n en invente pas, et c est le
    // defaut du serveur (limit ?? 30) qui s applique.
    "GET /api/songs": {
      songs: [
        {
          _id: "1",
          title: "T",
          audioUrl: "https://res.cloudinary.com/secret/signe.mp3",
          lyrics: "x".repeat(5000),
          __v: 3,
          artist: { _id: "a1", stageName: "KAIAMBA" },
        },
      ],
    },
  });
  const texte = (await outil("moziik_titres_lister").executer(c, {})).content[0].text;
  v("l adresse audio signee ne sort pas", !texte.includes("cloudinary"));
  v("les paroles entieres ne sortent pas", !texte.includes("xxxxx"));
  v("__v ne sort pas", !texte.includes("__v"));
  v("l artiste est aplati en « nom (id) »", texte.includes("KAIAMBA (a1)"), texte.slice(0, 200));
}

{
  // Le passage generique doit retirer les memes champs.
  const c = faux({ "GET /api/admin/stats": { total: 1, exemple: { audioUrl: "https://x/a.mp3", lyrics: "y" } } });
  const texte = (await outil("moziik_statistiques").executer(c, {})).content[0].text;
  v("alleger retire audioUrl en profondeur", !texte.includes("audioUrl"));
  v("alleger retire lyrics en profondeur", !texte.includes("lyrics"));
  v("alleger garde le reste", texte.includes("total"));
}

/* ------------------------------------------------- erreurs remontees -- */
console.log("--- les erreurs ---");

{
  const c = faux({ "GET /api/admin/stats": new ErreurMoziik("Réservé aux administrateurs.", 403, "/api/admin/stats") });
  let leve = null;
  try {
    await outil("moziik_statistiques").executer(c, {});
  } catch (e) {
    leve = e;
  }
  v("l erreur de l API remonte telle quelle", leve instanceof ErreurMoziik && leve.statut === 403);
  v("le message du serveur est conserve", leve && leve.message === "Réservé aux administrateurs.");
}

/* ------------------------------------------------------ le client --- */
console.log("--- le client, sans identifiants ---");

{
  const sans = new ClientMoziik({ base: "https://exemple.test", refreshToken: null, email: null, motDePasse: null });
  v("se declare non configure", sans.configure() === false);
  let message = "";
  try {
    await sans.jeton();
  } catch (e) {
    message = e.message;
  }
  v("explique quoi renseigner", /MOZIIK_REFRESH_TOKEN/.test(message), message);
}

{
  const avec = new ClientMoziik({ base: "https://exemple.test/", refreshToken: "r" });
  v("l URL perd son slash final", avec.base === "https://exemple.test");
  v("se declare configure", avec.configure() === true);
}

console.log(`\n${ok} ok, ${ko} echec(s) sur ${ok + ko}`);
process.exit(ko ? 1 : 0);
