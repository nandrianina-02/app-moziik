/**
 * Les mentions `@quelquun` dans un texte libre.
 *
 * Un seul endroit décide de ce qui est une mention, pour que l'affichage
 * et la notification tombent d'accord : ce qui est souligné dans un
 * commentaire doit être exactement ce qui déclenche une alerte, sinon on
 * prévient des gens qui ne se voient pas cités, ou l'inverse.
 *
 * Le motif exige que l'arobase soit précédée d'un début de texte ou d'un
 * caractère qui n'est pas une lettre : une adresse email écrite dans un
 * commentaire ne doit pas être lue comme une mention de son domaine.
 */
export const MOTIF_MENTION = /(^|[^\p{L}\p{N}@._])@([a-z0-9._]{3,20})/giu;

/** Les noms d'utilisateur cités, en minuscules, sans doublon. */
export function extraireMentions(texte: string): string[] {
  const trouves = new Set<string>();
  for (const correspondance of texte.matchAll(MOTIF_MENTION)) {
    const nom = correspondance[2]?.toLowerCase().replace(/[._]+$/, "");
    if (nom && nom.length >= 3) trouves.add(nom);
  }
  return [...trouves];
}

export type MorceauTexte =
  | { type: "texte"; valeur: string }
  | { type: "mention"; valeur: string; username: string };

/**
 * Découpe un texte en morceaux affichables : du texte ordinaire, et des
 * mentions cliquables. Le découpage se fait au rendu, jamais à
 * l'enregistrement — le commentaire reste stocké tel qu'il a été écrit.
 */
export function decouperMentions(texte: string): MorceauTexte[] {
  const morceaux: MorceauTexte[] = [];
  let curseur = 0;

  for (const correspondance of texte.matchAll(MOTIF_MENTION)) {
    const debut = correspondance.index ?? 0;
    const prefixe = correspondance[1] ?? "";
    const username = correspondance[2].toLowerCase();

    // Le point ou le tiret bas final appartient à la ponctuation, pas au
    // nom : « merci @zo. » mentionne « zo ».
    const propre = username.replace(/[._]+$/, "");
    const reste = username.slice(propre.length);

    const avant = texte.slice(curseur, debut) + prefixe;
    if (avant) morceaux.push({ type: "texte", valeur: avant });

    if (propre.length >= 3) {
      morceaux.push({ type: "mention", valeur: `@${propre}`, username: propre });
      if (reste) morceaux.push({ type: "texte", valeur: reste });
    } else {
      morceaux.push({ type: "texte", valeur: `@${username}` });
    }

    curseur = debut + correspondance[0].length;
  }

  const fin = texte.slice(curseur);
  if (fin) morceaux.push({ type: "texte", valeur: fin });
  return morceaux;
}
