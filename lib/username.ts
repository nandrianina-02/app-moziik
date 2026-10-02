import User from "@/models/User";

/**
 * Le nom d'utilisateur : l'adresse publique d'un compte.
 *
 * Il sert à trois choses, et c'est ce qui dicte sa forme : mentionner
 * quelqu'un dans un commentaire (`@zo`), lui rendre visite (`/membre/zo`),
 * et le retrouver dans la recherche. D'où un jeu de caractères réduit —
 * minuscules, chiffres, point et tiret bas — sans accent ni espace : ce
 * qu'on peut taper au clavier, lire dans une URL, et reconnaître dans une
 * phrase sans se demander où il s'arrête.
 */

export const MOTIF_USERNAME = /^[a-z0-9._]{3,20}$/;

/**
 * Enlève accents, espaces et tout ce qui ne tient pas dans une adresse.
 *
 * Accepte l'absence de valeur : neuf comptes de la base n'ont pas de nom
 * du tout — créés par un chemin aujourd'hui disparu. `undefined.normalize`
 * levait un TypeError qui remontait jusqu'à la route, et la page « Mon
 * compte » affichait « Connecte-toi » à quelqu'un déjà connecté.
 */
export function normaliserUsername(valeur?: string | null): string {
  if (!valeur) return "";
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 20);
}

/**
 * Un identifiant libre, dérivé d'un nom.
 *
 * Les collisions sont fréquentes — deux « Jean Rakoto » ne sont pas une
 * exception — donc on suffixe jusqu'à trouver. La boucle est bornée : au
 * bout de vingt essais on bascule sur un suffixe aléatoire plutôt que de
 * balayer indéfiniment une base qui compte peut-être mille homonymes.
 */
export async function genererUsername(base?: string | null): Promise<string> {
  const racine = normaliserUsername(base) || "membre";
  const socle = racine.length >= 3 ? racine : `${racine}membre`.slice(0, 20);

  for (let i = 0; i < 20; i++) {
    const candidat = i === 0 ? socle : `${socle.slice(0, 20 - String(i).length)}${i}`;
    if (!(await User.exists({ username: candidat }))) return candidat;
  }

  const alea = Math.random().toString(36).slice(2, 7);
  return `${socle.slice(0, 14)}${alea}`;
}

/**
 * Le nom d'utilisateur d'un compte, créé au besoin.
 *
 * Les comptes existent depuis avant ce champ : plutôt qu'une migration
 * unique — qui ne dirait rien des comptes créés par un chemin oublié — on
 * comble à la première lecture. Un compte finit donc par en avoir un dès
 * qu'il se montre quelque part.
 */
export async function assurerUsername(user: {
  _id: unknown;
  name?: string;
  username?: string;
}): Promise<string | undefined> {
  if (user.username) return user.username;

  const choisi = await genererUsername(user.name);

  // Écriture ciblée, et non `user.save()`.
  //
  // `save()` revalide le document ENTIER. Or dix comptes de la base
  // portent un thème enregistré avant que `secondary`, `warning` et
  // `radius` ne deviennent obligatoires : leur document ne passe plus la
  // validation, et combler un nom d'utilisateur échouait à cause de
  // champs sans aucun rapport. La page « Mon compte » devenait alors
  // inaccessible — pour deux administrateurs sur quatre, dont le compte
  // principal du catalogue.
  //
  // `updateOne` n'écrit que ce champ et ne valide que lui. Réparer les
  // thèmes incomplets reste à faire, mais ce n'est pas à une lecture de
  // profil de s'en charger.
  try {
    await User.updateOne({ _id: user._id }, { $set: { username: choisi } });
    user.username = choisi;
    return choisi;
  } catch {
    // Collision sur l'index unique — deux requêtes simultanées pour le
    // même compte, ou un identifiant pris entre-temps. Le compte reste
    // sans adresse publique jusqu'à la prochaine lecture, ce qui est sans
    // conséquence : rien n'en dépend pour afficher un profil.
    return undefined;
  }
}
