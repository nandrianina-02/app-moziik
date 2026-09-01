import Artist from "@/models/Artist";

/**
 * La photo de compte devient la photo d'artiste, tant qu'il n'y en a pas
 * d'autre.
 *
 * Les deux images sont distinctes par nature — `User.avatarUrl` est
 * l'avatar du compte, `Artist.coverUrl` la photo publique de l'artiste — et
 * rien ne les reliait : un membre déjà photographié, promu artiste, se
 * retrouvait avec un profil public sans visage, sans que rien ne le
 * signale.
 *
 * Le report est volontairement à sens unique et non destructif : dès que
 * l'artiste (ou l'administration) a choisi une photo d'artiste, le compte
 * peut changer d'avatar sans l'écraser.
 */
export async function reporterPhotoDeCompte(userId: string, avatarUrl?: string | null): Promise<boolean> {
  if (!avatarUrl) return false;

  const resultat = await Artist.updateOne(
    // `$in: [null, ""]` autant que l'absence : un profil créé sans photo
    // n'a pas le champ, un profil vidé le garde à chaîne vide.
    { user: userId, $or: [{ coverUrl: { $exists: false } }, { coverUrl: { $in: [null, ""] } }] },
    { $set: { coverUrl: avatarUrl } }
  );

  return (resultat.modifiedCount ?? 0) > 0;
}
