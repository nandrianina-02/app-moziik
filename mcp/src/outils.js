/**
 * Le catalogue d'outils exposés au modèle.
 *
 * TROIS RÈGLES, TENUES PARTOUT
 *
 * 1. **Aucune règle métier ici.** Chaque outil appelle une route qui
 *    existe déjà sur le site. Les droits sont appliqués par le serveur,
 *    jamais par ce fichier : un compte artiste se verra refuser une route
 *    d'administration, quoi que demande le modèle. Dupliquer ces règles
 *    ici les ferait diverger, et une règle d'accès qui diverge se
 *    remarque le jour où elle laisse passer quelqu'un.
 *
 * 2. **Aucune route inventée.** Chaque `route` ci-dessous a été ouverte et
 *    lue dans app/api/. Ce qui n'existe pas n'est pas exposé — voir
 *    `MANQUES` en fin de fichier, qui dit ce que ce serveur NE PEUT PAS
 *    faire et pourquoi. Un outil qui échoue systématiquement est pire
 *    qu'un outil absent : le modèle le réessaie.
 *
 * 3. **Les gestes irréversibles demandent le titre exact.** Le client MCP
 *    fait déjà valider chaque appel par un humain, mais une validation
 *    dans une fenêtre de discussion se donne vite, et un identifiant
 *    erroné ressemble à n'importe quel autre identifiant. On relit donc
 *    le contenu visé et on refuse si le libellé fourni ne correspond pas.
 */

import { liste, reduire, reponse, erreur } from "./format.js";
import { parametres } from "./moziik.js";

/* ------------------------------------------------------------ formes -- */

const CHAMPS_TITRE = [
  "_id",
  "title",
  "artist",
  "album",
  "genre",
  "status",
  "duration",
  "bpm",
  "releaseDate",
  "playsCount",
  "likesCount",
  "explicit",
  "language",
  "univers",
];

const CHAMPS_ARTISTE = [
  "_id",
  "stageName",
  "verified",
  "genres",
  "totalPlays",
  "bio",
  "eventPublishingAuthorized",
  "monetizationEnabled",
  "univers",
];

const CHAMPS_ALBUM = ["_id", "title", "type", "artist", "releaseDate", "songs"];

/** Un identifiant MongoDB, pour refuser une bêtise avant l'aller-retour. */
const ID = { type: "string", pattern: "^[0-9a-fA-F]{24}$", description: "identifiant MongoDB" };

function obj(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

/* ------------------------------------------------- garde-fou commun -- */

/**
 * Relit le contenu visé et compare son libellé à celui fourni.
 *
 * C'est le seul endroit du serveur qui refuse quelque chose de son propre
 * chef. La comparaison est volontairement tolérante à la casse et aux
 * espaces — on vérifie que le modèle sait de QUOI il parle, pas qu'il
 * recopie au caractère près.
 */
async function confirmer(client, route, champ, attendu, quoi) {
  const doc = await client.get(route);
  const reel = doc && doc[quoi] ? doc[quoi][champ] : undefined;
  if (!reel) return { ok: false, message: `${route} : contenu introuvable.` };

  const normal = (v) => String(v).trim().toLowerCase().replace(/\s+/g, " ");
  if (normal(reel) !== normal(attendu)) {
    return {
      ok: false,
      message:
        `Refus : la confirmation ne correspond pas. Attendu « ${reel} », reçu « ${attendu} ». ` +
        "Vérifiez l'identifiant avant de recommencer.",
      reel,
    };
  }
  return { ok: true, reel };
}

/* ------------------------------------------------------------ outils -- */

export const OUTILS = [
  /* ---------------------------------------------------------- compte -- */
  {
    nom: "moziik_moi",
    description:
      "Qui est le compte connecté à ce serveur, et avec quel rôle. À appeler en premier en cas de doute : c'est le rôle qui décide de ce que les autres outils pourront faire.",
    lectureSeule: true,
    entree: obj({}),
    async executer(client) {
      const moi = await client.moi();
      return reponse({
        compte: reduire(moi, ["_id", "name", "email", "username", "role", "createdAt"]),
        // Rendu ici plutot que laisse au README : c'est le modele qui a
        // besoin de savoir ce qui est hors de portee, sinon il essaie,
        // echoue, et recommence autrement.
        hors_de_portee: MANQUES,
      });
    },
  },

  /* --------------------------------------------------------- musique -- */
  {
    nom: "moziik_titres_lister",
    description:
      "Liste les titres du catalogue, filtrable par artiste ou genre. Pour une recherche par mots, préférer moziik_rechercher.",
    lectureSeule: true,
    entree: obj({
      artiste: { ...ID, description: "identifiant d'artiste" },
      genre: { type: "string" },
      tri: { type: "string", enum: ["recent", "popular"], default: "recent" },
      limite: { type: "integer", minimum: 1, maximum: 100, default: 30 },
      page: { type: "integer", minimum: 1, default: 1 },
    }),
    async executer(client, a) {
      const r = await client.get(
        `/api/songs${parametres({
          artist: a.artiste,
          genre: a.genre,
          sort: a.tri === "popular" ? "popular" : undefined,
          limit: a.limite,
          page: a.page,
        })}`
      );
      return reponse({
        titres: liste(r.songs, CHAMPS_TITRE),
        page: r.page,
        total: r.total,
        encore: r.hasMore,
      });
    },
  },
  {
    nom: "moziik_titre_lire",
    description: "Tout ce que le catalogue sait d'un titre : crédits, tempo, statut, album.",
    lectureSeule: true,
    entree: obj({ id: ID }, ["id"]),
    async executer(client, a) {
      const r = await client.get(`/api/songs/${a.id}`);
      return reponse(
        reduire(r.song, [
          ...CHAMPS_TITRE,
          "description",
          "tags",
          "composer",
          "producer",
          "musicalKey",
          "isrc",
          "copyright",
          "featuring",
          "trimStart",
          "trimEnd",
        ])
      );
    },
  },
  {
    nom: "moziik_titre_modifier",
    description:
      "Modifie un titre existant. N'envoie que les champs fournis. Réservé au propriétaire ou à un administrateur — le serveur refuse les autres.",
    entree: obj({
      id: ID,
      titre: { type: "string", maxLength: 200 },
      genre: { type: "string", maxLength: 60 },
      description: { type: "string", maxLength: 1000 },
      langue: { type: "string" },
      compositeur: { type: "string" },
      producteur: { type: "string" },
      tags: { type: "array", items: { type: "string" }, maxItems: 20 },
      explicite: { type: "boolean" },
      bpm: { type: "number" },
      tonalite: { type: "string" },
      isrc: { type: "string" },
      copyright: { type: "string" },
      albumId: { type: "string", description: "identifiant d'album, ou chaîne vide pour un single" },
    }, ["id"]),
    async executer(client, a) {
      const corps = {};
      const map = {
        titre: "title",
        genre: "genre",
        description: "description",
        langue: "language",
        compositeur: "composer",
        producteur: "producer",
        tags: "tags",
        explicite: "explicit",
        bpm: "bpm",
        tonalite: "musicalKey",
        isrc: "isrc",
        copyright: "copyright",
        albumId: "albumId",
      };
      for (const [fr, en] of Object.entries(map)) {
        if (a[fr] !== undefined) corps[en] = a[fr];
      }
      if (Object.keys(corps).length === 0) {
        return erreur("Aucun champ à modifier n'a été fourni.");
      }
      // `bpmSource` accompagne un tempo saisi à la main : sans lui, rien
      // ne distingue une valeur donnée d'une valeur mesurée, et la
      // prochaine analyse automatique l'écraserait.
      if (corps.bpm !== undefined) corps.bpmSource = "manuel";

      const r = await client.patch(`/api/songs/${a.id}`, corps);
      return reponse({ modifie: reduire(r.song, CHAMPS_TITRE) });
    },
  },
  {
    nom: "moziik_titre_supprimer",
    description:
      "Supprime définitivement un titre. Exige le titre exact en confirmation : le serveur le relit et refuse si cela ne correspond pas.",
    destructif: true,
    entree: obj(
      {
        id: ID,
        confirmation_titre: {
          type: "string",
          description: "le titre exact du morceau, tel qu'il est en base",
        },
      },
      ["id", "confirmation_titre"]
    ),
    async executer(client, a) {
      const v = await confirmer(client, `/api/songs/${a.id}`, "title", a.confirmation_titre, "song");
      if (!v.ok) return erreur(v.message, v.reel ? { titre_reel: v.reel } : undefined);

      await client.delete(`/api/songs/${a.id}`);
      return reponse({ supprime: true, id: a.id, titre: v.reel });
    },
  },
  {
    nom: "moziik_titres_a_valider",
    description:
      "Les titres en attente de validation, refusés ou programmés. Administrateur uniquement.",
    lectureSeule: true,
    entree: obj({
      statut: { type: "string", enum: ["pending", "scheduled", "rejected", "published", "draft"] },
    }),
    async executer(client, a) {
      const r = await client.get(`/api/admin/songs${parametres({ status: a.statut })}`);
      return reponse({ titres: liste(r.songs ?? r, CHAMPS_TITRE) });
    },
  },
  {
    nom: "moziik_titre_moderer",
    description:
      "Approuve ou refuse un titre en attente. Approuver le publie, ou le programme si sa date de sortie est à venir. Administrateur uniquement.",
    entree: obj(
      { id: ID, decision: { type: "string", enum: ["approve", "reject"] } },
      ["id", "decision"]
    ),
    async executer(client, a) {
      const r = await client.post(`/api/admin/songs/${a.id}/moderate`, { decision: a.decision });
      return reponse({ decision: a.decision, titre: reduire(r.song, CHAMPS_TITRE) });
    },
  },

  /* --------------------------------------------------------- paroles -- */
  {
    nom: "moziik_paroles_lire",
    description:
      "Les paroles d'un titre, sous forme structurée : texte nu, synchronisation éventuelle, et les lignes horodatées avec leur début et leur fin.",
    lectureSeule: true,
    entree: obj({ id: ID }, ["id"]),
    async executer(client, a) {
      const r = await client.get(`/api/songs/${a.id}/lyrics`);
      return reponse({
        synchronisees: r.lyrics.synced,
        credits: r.lyrics.credits,
        nombre_lignes: r.lyrics.lines.length,
        texte: r.lyrics.plainText,
        lignes: r.lyrics.lines,
      });
    },
  },
  {
    nom: "moziik_paroles_ecrire",
    description:
      "Enregistre les paroles d'un titre. Accepte soit du texte brut ou du LRC complet (champ `lrc`), soit des lignes horodatées (champ `lignes`). Réservé au propriétaire ou à un administrateur.",
    entree: obj({
      id: ID,
      lrc: {
        type: "string",
        maxLength: 20000,
        description:
          "paroles en texte libre, ou au format LRC avec horodatages [mm:ss.cc] en tête de ligne",
      },
      lignes: {
        type: "array",
        maxItems: 2000,
        description: "lignes horodatées ; startTime en secondes, null si la ligne n'est pas calée",
        items: obj(
          {
            text: { type: "string", maxLength: 500 },
            startTime: { type: ["number", "null"], minimum: 0 },
          },
          ["text", "startTime"]
        ),
      },
      credits: { type: "string", maxLength: 200, description: "qui a transcrit ou synchronisé" },
    }, ["id"]),
    async executer(client, a) {
      if (a.lrc === undefined && a.lignes === undefined) {
        return erreur("Fournir soit `lrc`, soit `lignes`.");
      }
      const corps = {};
      if (a.lrc !== undefined) corps.raw = a.lrc;
      else corps.lines = a.lignes;
      if (a.credits) corps.meta = { by: a.credits };

      const r = await client.put(`/api/songs/${a.id}/lyrics`, corps);
      return reponse({
        synchronisees: r.lyrics.synced,
        nombre_lignes: r.lyrics.lines.length,
        texte: r.lyrics.plainText,
      });
    },
  },
  {
    nom: "moziik_paroles_supprimer",
    description:
      "Retire les paroles d'un titre. Exige le titre exact en confirmation. Réservé au propriétaire ou à un administrateur.",
    destructif: true,
    entree: obj({ id: ID, confirmation_titre: { type: "string" } }, ["id", "confirmation_titre"]),
    async executer(client, a) {
      const v = await confirmer(client, `/api/songs/${a.id}`, "title", a.confirmation_titre, "song");
      if (!v.ok) return erreur(v.message, v.reel ? { titre_reel: v.reel } : undefined);

      await client.delete(`/api/songs/${a.id}/lyrics`);
      return reponse({ supprimees: true, id: a.id, titre: v.reel });
    },
  },

  /* -------------------------------------------------------- artistes -- */
  {
    nom: "moziik_artistes_lister",
    description: "Les artistes du catalogue, filtrables par nom de scène.",
    lectureSeule: true,
    entree: obj({ recherche: { type: "string", maxLength: 100 } }),
    async executer(client, a) {
      const r = await client.get(`/api/artists${parametres({ search: a.recherche })}`);
      return reponse({ artistes: liste(r.artists ?? r, CHAMPS_ARTISTE) });
    },
  },
  {
    nom: "moziik_artiste_lire",
    description: "La fiche complète d'un artiste, telle que l'administration la voit.",
    lectureSeule: true,
    entree: obj({ id: ID }, ["id"]),
    async executer(client, a) {
      const r = await client.get(`/api/admin/artists/${a.id}`);
      return reponse(reduire(r.artist ?? r, [...CHAMPS_ARTISTE, "socialLinks", "bannerUrl", "user"]));
    },
  },
  {
    nom: "moziik_artiste_modifier",
    description:
      "Modifie la fiche d'un artiste : nom de scène, biographie, genres, vérification, autorisations. Administrateur uniquement.",
    entree: obj({
      id: ID,
      nom_de_scene: { type: "string", maxLength: 80 },
      bio: { type: "string", maxLength: 2000 },
      genres: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 10 },
      verifie: { type: "boolean" },
      peut_publier_evenements: { type: "boolean" },
      monetisation_activee: { type: "boolean" },
    }, ["id"]),
    async executer(client, a) {
      const corps = {};
      if (a.nom_de_scene !== undefined) corps.stageName = a.nom_de_scene;
      if (a.bio !== undefined) corps.bio = a.bio;
      if (a.genres !== undefined) corps.genres = a.genres;
      if (a.verifie !== undefined) corps.verified = a.verifie;
      if (a.peut_publier_evenements !== undefined) {
        corps.eventPublishingAuthorized = a.peut_publier_evenements;
      }
      if (a.monetisation_activee !== undefined) corps.monetizationEnabled = a.monetisation_activee;

      if (Object.keys(corps).length === 0) return erreur("Aucun champ à modifier n'a été fourni.");

      const r = await client.patch(`/api/admin/artists/${a.id}`, corps);
      return reponse({ modifie: reduire(r.artist ?? r, CHAMPS_ARTISTE) });
    },
  },

  /* ------------------------------------------------------- recherche -- */
  {
    nom: "moziik_rechercher",
    description:
      "Recherche globale sur le catalogue : titres, artistes, albums, playlists, évènements, genres. C'est l'outil à utiliser pour retrouver un identifiant à partir d'un nom.",
    lectureSeule: true,
    entree: obj(
      {
        q: { type: "string", maxLength: 100 },
        type: {
          type: "string",
          enum: ["all", "songs", "artists", "albums", "playlists", "events", "genres"],
          default: "all",
        },
        genre: { type: "string" },
        tri: { type: "string", enum: ["relevance", "popularity", "recent"] },
        limite: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        page: { type: "integer", minimum: 1, default: 1 },
      },
      ["q"]
    ),
    async executer(client, a) {
      const r = await client.get(
        `/api/search${parametres({
          q: a.q,
          type: a.type,
          genre: a.genre,
          sort: a.tri,
          limit: a.limite,
          page: a.page,
        })}`
      );
      // La forme de la réponse dépend du type demandé : on la rend telle
      // quelle, allégée. L'aplatir imposerait une structure que l'API ne
      // garantit pas, et qui se périmerait au premier changement.
      return reponse(alleger(r));
    },
  },

  /* ---------------------------------------------------------- albums -- */
  {
    nom: "moziik_albums_lister",
    description: "Les albums, filtrables par artiste.",
    lectureSeule: true,
    entree: obj({ artiste: ID }),
    async executer(client, a) {
      const r = await client.get(`/api/albums${parametres({ artist: a.artiste })}`);
      return reponse({ albums: liste(r.albums ?? r, CHAMPS_ALBUM) });
    },
  },

  /* ---------------------------------------------------- statistiques -- */
  {
    nom: "moziik_statistiques",
    description:
      "Le tableau de bord de l'administration : comptes, titres, écoutes, abonnements. Administrateur uniquement.",
    lectureSeule: true,
    entree: obj({}),
    async executer(client) {
      return reponse(alleger(await client.get("/api/admin/stats")));
    },
  },
  {
    nom: "moziik_classement",
    description:
      "Le palmarès des titres, artistes, albums ou auditeurs sur une période. Public.",
    lectureSeule: true,
    entree: obj({
      type: { type: "string", enum: ["songs", "artists", "albums", "listeners"], default: "songs" },
      periode: { type: "string", enum: ["day", "week", "month", "year", "all"], default: "week" },
      genre: { type: "string" },
    }),
    async executer(client, a) {
      const r = await client.get(
        `/api/charts${parametres({ type: a.type, period: a.periode, genre: a.genre })}`
      );
      return reponse(alleger(r));
    },
  },
  {
    nom: "moziik_revenus",
    description:
      "Les rémunérations du compte connecté, calculées par le traitement des royalties. Un compte artiste y voit les siennes ; un administrateur n'y voit que les siennes, pas celles du catalogue.",
    lectureSeule: true,
    entree: obj({}),
    async executer(client) {
      const r = await client.get("/api/artist/revenus");
      return reponse({
        total_usd: r.totalUSD,
        total_ecoutes: r.totalPlays,
        lignes: liste(r.royalties, ["period", "plays", "amountUSD", "artisteId", "status"]),
      });
    },
  },

  /* --------------------------------------------------------- rapport -- */
  {
    nom: "moziik_rapport_lire",
    description:
      "Le rapport d'activité de la période en cours, avec son analyse archivée si elle existe. Ne consomme aucun crédit d'IA. Administrateur uniquement.",
    lectureSeule: true,
    entree: obj({}),
    async executer(client) {
      return reponse(alleger(await client.get("/api/admin/insights")));
    },
  },
  {
    nom: "moziik_rapport_generer",
    description:
      "Recalcule le rapport d'activité et le fait relire par l'IA, puis l'archive. Consomme des crédits d'IA : préférer moziik_rapport_lire pour une simple consultation. Administrateur uniquement.",
    entree: obj({}),
    async executer(client) {
      return reponse(alleger(await client.post("/api/admin/insights", {})));
    },
  },

  /* ------------------------------------------------------- modération -- */
  {
    nom: "moziik_commentaires_lister",
    description:
      "Les commentaires, filtrables par sentiment ou signalement. Sert à repérer ce qui demande une décision. Administrateur uniquement.",
    lectureSeule: true,
    entree: obj({
      sentiment: { type: "string" },
      recherche: { type: "string", maxLength: 100 },
      signales_seulement: { type: "boolean" },
    }),
    async executer(client, a) {
      const r = await client.get(
        `/api/admin/comments${parametres({
          sentiment: a.sentiment,
          search: a.recherche,
          flagged: a.signales_seulement ? "1" : undefined,
        })}`
      );
      return reponse(alleger(r));
    },
  },

  /* -------------------------------------------------------------- IA -- */
  {
    nom: "moziik_ia_metadonnees",
    description:
      "Propose genre, tags, description et langue pour un titre, à partir de son nom et éventuellement de ses paroles. Ne modifie rien : la proposition est à relire puis à appliquer avec moziik_titre_modifier.",
    lectureSeule: true,
    entree: obj(
      {
        titre: { type: "string", maxLength: 200 },
        artiste: { type: "string", maxLength: 200 },
        album: { type: "string", maxLength: 200 },
        paroles: { type: "string", maxLength: 8000 },
        langues: {
          type: "array",
          items: { type: "string", maxLength: 40 },
          minItems: 1,
          maxItems: 12,
          description: "langues possibles du morceau, par exemple [\"Malagasy\", \"Français\"]",
        },
      },
      ["titre", "langues"]
    ),
    async executer(client, a) {
      const r = await client.post("/api/ai/song-metadata", {
        title: a.titre,
        artistName: a.artiste ?? "",
        album: a.album,
        lyrics: a.paroles,
        languages: a.langues,
      });
      return reponse(alleger(r));
    },
  },
  {
    nom: "moziik_ia_biographie",
    description:
      "Rédige ou retouche la biographie d'un artiste à partir de notes. Ne modifie rien : le texte est à relire puis à appliquer avec moziik_artiste_modifier.",
    lectureSeule: true,
    entree: obj({
      notes: { type: "string", maxLength: 3000, description: "éléments factuels à utiliser" },
      bio: { type: "string", maxLength: 2000, description: "biographie actuelle, si on la retouche" },
    }),
    async executer(client, a) {
      const r = await client.post("/api/ai/artist-bio", { notes: a.notes ?? "", bio: a.bio });
      return reponse(alleger(r));
    },
  },
];

/**
 * Allège une réponse d'API dont on ne maîtrise pas la forme.
 *
 * Retire ce qui ne sert jamais au modèle et qui coûte le plus : adresses
 * audio signées, paroles entières, champs internes de mongoose. Préserve
 * tout le reste — une réponse tronquée au jugé serait pire qu'une
 * réponse longue.
 */
function alleger(valeur, profondeur = 0) {
  if (profondeur > 8 || valeur === null || typeof valeur !== "object") return valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => alleger(v, profondeur + 1));

  const sortie = {};
  for (const [cle, v] of Object.entries(valeur)) {
    if (cle === "audioUrl" || cle === "lyrics" || cle === "__v" || cle === "passwordHash") continue;
    sortie[cle] = alleger(v, profondeur + 1);
  }
  return sortie;
}

/**
 * Ce que ce serveur ne peut PAS faire, et pourquoi.
 *
 * Écrit ici plutôt que dans le README : c'est la liste qu'il faut
 * relire avant d'ajouter un outil, pour ne pas en inventer un qui
 * échouerait à chaque appel.
 */
export const MANQUES = [
  "Créer un titre de bout en bout : POST /api/songs exige `audioUrl` et `coverUrl` déjà hébergées. L'envoi de fichier se fait depuis le navigateur vers Cloudinary avec un préréglage non signé (lib/cloudinaryClient.ts) ; aucune route serveur ne l'accepte, et faire transiter plusieurs mégaoctets par une route Next.js dépasserait sa limite de charge.",
  "Consulter les royalties de TOUT le catalogue : seule /api/artist/revenus existe, et elle ne rend que celles du compte connecté. Il n'y a aucune route d'administration sur le modèle Royalty.",
  "Déclencher le calcul des royalties, la publication des titres programmés ou le rapport hebdomadaire : ces routes /api/cron/* s'authentifient par CRON_SECRET, pas par un compte. Exposer ce secret ici lui donnerait une portée bien plus large que ce serveur.",
  "Détecter automatiquement les contenus problématiques : /api/cron/moderate-comments fait ce travail, mais par CRON_SECRET également. On peut lister et décider, pas lancer la détection.",
];
