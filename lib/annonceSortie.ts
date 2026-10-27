import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { notifyMany } from "@/lib/notify";

/**
 * Prévient les abonnés d'un artiste qu'il vient de publier un titre :
 * notification dans la cloche et sur le téléphone.
 *
 * Appelée partout où un titre devient public — publication directe par
 * l'administration, validation d'un titre en attente, sortie planifiée
 * arrivée à échéance. Une sortie ne s'annonce qu'une fois : la date
 * d'annonce est posée en base par une écriture conditionnelle, si bien
 * que deux appels simultanés, ou un titre dépublié puis republié, ne
 * renvoient pas la même alerte.
 */
export async function annoncerSortie(songId: string): Promise<void> {
  const song = await Song.findOneAndUpdate(
    { _id: songId, status: "published", sortieAnnoncee: { $exists: false } },
    { $set: { sortieAnnoncee: new Date() } },
    { new: true }
  )
    .select("title artist coverUrl")
    .lean();
  if (!song) return;

  const artist = await Artist.findById(song.artist).select("stageName followers").lean();
  if (!artist || artist.followers.length === 0) return;

  await notifyMany(
    artist.followers.map((f) => f.toString()),
    {
      type: "new_song",
      title: "Nouveau son disponible",
      message: `${artist.stageName} vient de publier "${song.title}".`,
      link: `/son/${song._id}`,
      imageUrl: song.coverUrl,
    }
  );
}
