/**
 * Les stations de la page Radio, nommées et adressables.
 *
 * POURQUOI ELLES SORTENT DE LA PAGE
 *
 * Une station n'était jusqu'ici qu'une tuile : un objet déclaré dans le
 * composant, sans existence hors de lui. On pouvait la lancer, pas la
 * désigner. Or la messagerie doit pouvoir en envoyer une, et une carte
 * qui promet « Lancer la radio » sans rouvrir la bonne station serait un
 * bouton décoratif.
 *
 * La clé devient donc l'adresse : `/radio?station=<cle>` rouvre la même
 * station chez la personne qui reçoit le lien. Ce fichier n'importe rien
 * du serveur — il est lu par la page comme par le sélecteur de contenu.
 */

export type Station = {
  cle: string;
  label: string;
  /** D'où viennent les titres. Le sélecteur ne s'en sert pas, la page si. */
  fetchUrl: string;
  /** Genre, quand la station en est un — le lecteur le relit pour prolonger. */
  genre?: string;
  /** Aplat de la tuile. Fixe et indépendant du thème : voir la page Radio. */
  fond: string;
  /** Ce qu'on comprend de la station sans l'avoir lancée. */
  description: string;
};

export const STATIONS: Station[] = [
  {
    cle: "tendances",
    label: "Tendances",
    fetchUrl: "/api/songs?limit=50&sort=popular",
    fond: "bg-[#C63F1C]",
    description: "Ce que tout le monde écoute en ce moment.",
  },
  {
    cle: "favoris",
    label: "Mes favoris",
    fetchUrl: "/api/me/liked-songs",
    fond: "bg-[#C0356B]",
    description: "Les titres que vous avez aimés, en boucle.",
  },
  {
    cle: "nouveautes",
    label: "Nouveautés",
    fetchUrl: "/api/songs?limit=50",
    fond: "bg-[#2E5AAC]",
    description: "Les dernières sorties du catalogue.",
  },
  {
    cle: "afro",
    label: "Afro",
    fetchUrl: "/api/songs?limit=50&genre=Afro",
    genre: "Afro",
    fond: "bg-[#1B2A4A]",
    description: "Le répertoire afro du catalogue.",
  },
  {
    cle: "rock",
    label: "Rock",
    fetchUrl: "/api/songs?limit=50&genre=Rock",
    genre: "Rock",
    fond: "bg-[#5B4FCF]",
    description: "Guitares en avant.",
  },
  {
    cle: "instrumental",
    label: "Instrumental",
    fetchUrl: "/api/songs?limit=50&genre=Instrumental",
    genre: "Instrumental",
    fond: "bg-[#4B3F8F]",
    description: "Sans voix, pour travailler ou lire.",
  },
  {
    cle: "jazz",
    label: "Jazz",
    fetchUrl: "/api/songs?limit=50&genre=Jazz",
    genre: "Jazz",
    fond: "bg-[#3D2F6F]",
    description: "Standards et improvisations.",
  },
  {
    cle: "gospel",
    label: "Gospel",
    fetchUrl: "/api/songs?limit=50&genre=Gospel",
    genre: "Gospel",
    fond: "bg-[#B03050]",
    description: "Louange et répertoire évangélique.",
  },
];

export function stationParCle(cle?: string | null): Station | null {
  if (!cle) return null;
  return STATIONS.find((s) => s.cle === cle) ?? null;
}

/**
 * Une station de genre, construite à la volée.
 *
 * La page propose aussi les genres du catalogue, qui ne figurent pas dans
 * la liste fixe ci-dessus. Leur clé est préfixée pour qu'elle reste
 * lisible dans une URL et qu'on ne la confonde pas avec une station
 * nommée.
 */
export function stationDeGenre(genre: string): Station {
  return {
    cle: `genre:${genre}`,
    label: genre,
    fetchUrl: `/api/songs?limit=50&genre=${encodeURIComponent(genre)}`,
    genre,
    fond: "bg-[#3D2F6F]",
    description: `Tout le ${genre} du catalogue.`,
  };
}

/** Résout une clé, qu'elle désigne une station nommée ou un genre. */
export function resoudreStation(cle?: string | null): Station | null {
  if (!cle) return null;
  if (cle.startsWith("genre:")) {
    const genre = cle.slice("genre:".length);
    return genre ? stationDeGenre(genre) : null;
  }
  return stationParCle(cle);
}

export function cheminStation(cle: string): string {
  return `/radio?station=${encodeURIComponent(cle)}`;
}
