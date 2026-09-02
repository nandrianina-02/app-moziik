/**
 * Estimation du tempo d'un morceau, dans le navigateur.
 *
 * POURQUOI ICI ET PAS SUR LE SERVEUR
 *
 * Le fichier est déjà dans la page au moment de l'envoi, et le navigateur
 * sait décoder l'audio nativement. Faire le même travail côté serveur
 * demanderait ffmpeg dans une fonction sans état, pour un résultat
 * identique et une facture de bande passante en plus.
 *
 * CE QUE ÇA VAUT, ET CE QUE ÇA NE VAUT PAS
 *
 * La méthode est classique : on isole les graves, on mesure l'énergie qui
 * monte — les frappes — et on cherche la période qui revient le plus.
 * Elle est fiable sur ce qui a une batterie régulière, et mauvaise sur ce
 * qui n'en a pas : une ballade au piano, un a cappella, un salegy joué
 * librement n'ont pas de tempo constant à trouver.
 *
 * D'où le parti pris central : **ne rien répondre plutôt que répondre
 * faux**. Le tempo alimente les modes d'écoute (lib/modes.ts) — un
 * chiffre erroné range une berceuse dans « Sport ». Une estimation peu
 * sûre est donc rejetée, et le champ reste vide.
 */

/** Bornes musicales retenues. En dehors, c'est presque toujours une erreur d'octave. */
const BPM_MIN = 60;
const BPM_MAX = 190;

/** Fréquence de travail : les graves suffisent, inutile de garder 44 kHz. */
const ECHANTILLONNAGE = 8000;

/** Pas de la courbe d'énergie, en secondes. 10 ms suffisent à situer une frappe. */
const PAS = 0.01;

/** Portion analysée, en secondes, prise au milieu du morceau. */
const DUREE_ANALYSE = 60;

/**
 * En dessous, on refuse de conclure.
 *
 * Le score compare le pic d'autocorrélation à la moyenne des valeurs
 * absolues : au-delà de 4, une périodicité se détache nettement. En
 * dessous, la courbe est plate — il n'y a pas de tempo à lire.
 */
const CONFIANCE_MIN = 4;

/**
 * Tempo autour duquel l'oreille tranche les ambiguïtés d'octave.
 *
 * Une mesure à 150 se lit aussi bien à 75 : l'autocorrélation, elle, ne
 * sait pas choisir — elle a même tendance à préférer la période double,
 * qui tombe plus souvent sur un pas entier. Ce prior, centré sur le tempo
 * le plus courant en musique, départage. Il est délibérément large : il
 * incline, il n'impose pas.
 */
const TEMPO_PREFERE = 120;
const LARGEUR_PRIOR = 0.9; // en octaves

export type EstimationTempo = {
  bpm: number;
  /** Rapport pic/moyenne de l'autocorrélation. Plus c'est haut, plus c'est net. */
  confiance: number;
  /**
   * Le double ou la moitié obtenait un score voisin.
   *
   * L'erreur d'octave est le défaut connu de cette famille de méthodes :
   * une mesure à 140 se lit aussi bien à 70. On le signale au lieu de
   * trancher à la place de l'oreille.
   */
  ambigu: boolean;
};

/** Décode le fichier, ramené en mono et rééchantillonné. */
async function decoder(fichier: Blob): Promise<Float32Array> {
  const donnees = await fichier.arrayBuffer();

  // Un contexte temporaire sert au décodage : `OfflineAudioContext` ne
  // sait pas décoder à un taux arbitraire sur tous les navigateurs, on
  // rééchantillonne donc à la main juste après.
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const contexte = new AudioCtx();
  try {
    const buffer = await contexte.decodeAudioData(donnees);

    const source = buffer.getChannelData(0);
    const facteur = Math.max(1, Math.round(buffer.sampleRate / ECHANTILLONNAGE));

    // Fenêtre centrale : les introductions et les fins sont souvent hors
    // tempo, et analyser dix minutes n'apprend rien de plus que soixante
    // secondes.
    const echantillonsVoulus = Math.min(source.length, DUREE_ANALYSE * buffer.sampleRate);
    const debut = Math.max(0, Math.floor((source.length - echantillonsVoulus) / 2));

    const taille = Math.floor(echantillonsVoulus / facteur);
    const reduit = new Float32Array(taille);
    for (let i = 0; i < taille; i++) {
      // Moyenne du paquet : un simple prélèvement ferait du repliement de
      // spectre, qui inventerait des frappes.
      let somme = 0;
      for (let j = 0; j < facteur; j++) somme += source[debut + i * facteur + j] ?? 0;
      reduit[i] = somme / facteur;
    }
    return reduit;
  } finally {
    // Sans fermeture, chaque analyse laisse un contexte audio ouvert et
    // le navigateur finit par les refuser.
    contexte.close().catch(() => undefined);
  }
}

/**
 * Courbe d'apparition des frappes.
 *
 * L'énergie seule ne suffit pas : un morceau fort en continu donnerait une
 * courbe plate. On ne garde que les *hausses* d'énergie — c'est ce qui
 * marque le début d'un son.
 */
function courbeDattaque(signal: Float32Array, tauxEchantillon: number): Float32Array {
  const fenetre = Math.max(1, Math.round(PAS * tauxEchantillon));
  const nb = Math.floor(signal.length / fenetre);
  const energie = new Float32Array(nb);

  for (let i = 0; i < nb; i++) {
    let somme = 0;
    for (let j = 0; j < fenetre; j++) {
      const v = signal[i * fenetre + j];
      somme += v * v;
    }
    energie[i] = Math.sqrt(somme / fenetre);
  }

  const attaque = new Float32Array(nb);
  for (let i = 1; i < nb; i++) {
    const hausse = energie[i] - energie[i - 1];
    attaque[i] = hausse > 0 ? hausse : 0;
  }
  return attaque;
}

/** Retire la composante continue : sinon l'autocorrélation décroît bêtement avec le décalage. */
function centrer(valeurs: Float32Array): Float32Array {
  let somme = 0;
  for (const v of valeurs) somme += v;
  const moyenne = somme / (valeurs.length || 1);

  const centre = new Float32Array(valeurs.length);
  for (let i = 0; i < valeurs.length; i++) centre[i] = valeurs[i] - moyenne;
  return centre;
}

/**
 * Estime le tempo à partir d'un signal déjà décodé, mono.
 *
 * Séparée du décodage pour être vérifiable : cette partie ne dépend que
 * d'arithmétique, et se teste sur un signal fabriqué dont on connaît le
 * tempo (voir la note de tête pour ce que la méthode vaut).
 */
export function estimerDepuisSignal(
  signal: Float32Array,
  tauxEchantillon: number
): EstimationTempo | null {
  const attaque = centrer(courbeDattaque(signal, tauxEchantillon));
  if (attaque.length < 200) return null;

  // Un décalage exprimé en pas de 10 ms : 60 BPM = une frappe par seconde
  // = 100 pas.
  const lagMin = Math.floor(60 / BPM_MAX / PAS);
  const lagMax = Math.ceil(60 / BPM_MIN / PAS);

  const brut = new Map<number, number>();

  for (let lag = lagMin; lag <= lagMax && lag < attaque.length; lag++) {
    let somme = 0;
    for (let i = 0; i + lag < attaque.length; i++) somme += attaque[i] * attaque[i + lag];
    // Normalisé par le nombre de termes : sinon les petits décalages,
    // qui en comptent davantage, gagnent toujours.
    brut.set(lag, somme / (attaque.length - lag));
  }

  if (brut.size === 0) return null;

  /**
   * Le niveau ordinaire de la courbe, auquel le pic sera comparé.
   *
   * La médiane des valeurs absolues, et non leur moyenne. La courbe
   * d'attaque est centrée, donc un rythme net creuse de profonds
   * négatifs entre ses pics : la moyenne absolue enflait avec la netteté
   * du rythme, et la confiance *baissait* à mesure que le tempo devenait
   * plus évident — au point de rejeter les cas les plus faciles. La
   * médiane ignore ces extrêmes, qui sont précisément le signal.
   */
  const absolus = [...brut.values()].map(Math.abs).sort((a, b) => a - b);
  const reference = absolus[Math.floor(absolus.length / 2)];
  if (!(reference > 0)) return null;

  /**
   * Score d'un décalage, corrigé de deux défauts connus.
   *
   * 1. Le pic vrai tombe rarement sur un pas entier — 160 BPM, c'est 37,5
   *    pas — et se retrouve partagé entre deux décalages voisins, chacun
   *    à demi-hauteur. Sa période double, elle, tombe juste et rafle la
   *    mise. On somme donc les trois décalages voisins pour recoller le
   *    pic éparpillé.
   * 2. Le prior musical incline vers le tempo perçu plutôt que vers son
   *    harmonique.
   */
  const scoreCorrige = (lag: number) => {
    const voisinage = (brut.get(lag - 1) ?? 0) + (brut.get(lag) ?? 0) + (brut.get(lag + 1) ?? 0);
    const bpm = 60 / (lag * PAS);
    const ecart = Math.log2(bpm / TEMPO_PREFERE) / LARGEUR_PRIOR;
    return voisinage * Math.exp(-0.5 * ecart * ecart);
  };

  let meilleureFenetre = 0;
  let meilleurScore = -Infinity;
  for (const lag of brut.keys()) {
    const score = scoreCorrige(lag);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleureFenetre = lag;
    }
  }

  if (meilleureFenetre === 0) return null;

  /**
   * Le sommet réel, à l'intérieur de la fenêtre retenue.
   *
   * La fenêtre de trois décalages recolle un pic éparpillé, mais elle rend
   * du même coup ses trois positions presque équivalentes : le prior
   * départageait alors sur un décalage voisin du vrai, dont le score brut
   * est un creux et non un sommet. La confiance en sortait négative, et
   * les tempos les plus francs — 100, 120 — étaient rejetés.
   */
  let meilleurLag = meilleureFenetre;
  for (const lag of [meilleureFenetre - 1, meilleureFenetre + 1]) {
    if ((brut.get(lag) ?? -Infinity) > (brut.get(meilleurLag) ?? -Infinity)) meilleurLag = lag;
  }

  const confiance = (brut.get(meilleurLag) ?? 0) / reference;
  if (confiance < CONFIANCE_MIN) return null;

  const bpm = Math.round(60 / (meilleurLag * PAS));
  if (bpm < BPM_MIN || bpm > BPM_MAX) return null;

  // L'octave voisine reste-t-elle en lice après correction ? Si oui, le
  // doute est réel et doit être dit plutôt que tranché en silence.
  const rival = Math.max(
    scoreCorrige(Math.round(meilleureFenetre * 0.5)),
    scoreCorrige(Math.round(meilleureFenetre * 2))
  );
  const ambigu = rival > meilleurScore * 0.85;

  return { bpm, confiance: Number(confiance.toFixed(2)), ambigu };
}

/**
 * Estime le tempo d'un fichier audio.
 *
 * Renvoie `null` quand aucune périodicité ne se détache : c'est un
 * résultat, pas un échec — mieux vaut un champ vide qu'un chiffre inventé.
 */
export async function estimerTempo(fichier: Blob): Promise<EstimationTempo | null> {
  if (typeof window === "undefined") return null;

  try {
    return estimerDepuisSignal(await decoder(fichier), ECHANTILLONNAGE);
  } catch {
    // Format non décodable par ce navigateur : ce n'est pas au reste de
    // l'application de s'en émouvoir.
    return null;
  }
}
