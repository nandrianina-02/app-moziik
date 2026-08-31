import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import Album from "@/models/Album";
import EventModel from "@/models/Event";
import Playlist from "@/models/Playlist";
import Comment from "@/models/Comment";
import Notification from "@/models/Notification";
import RefreshToken from "@/models/RefreshToken";
import Subscription from "@/models/Subscription";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

/**
 * Suppression de son propre compte.
 *
 * Même cascade que la suppression administrative : un profil artiste
 * emporte ses titres, ses albums et ses évènements, faute de quoi le
 * catalogue garderait des références vers un artiste qui n'existe plus.
 * S'y ajoute ce qui n'appartient qu'à la personne — playlists,
 * commentaires, notifications, sessions, abonnement.
 *
 * Un abonnement Stripe encore actif n'est pas résilié ici : Moziik n'a pas
 * la main dessus sans appeler Stripe, et supprimer le compte sans le dire
 * laisserait un prélèvement courir. La route refuse donc, et renvoie vers
 * la résiliation.
 */
export const DELETE = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const user = await User.findById(authUser.id);
  if (!user) throw new ApiError("Compte introuvable.", 404);

  const abonnement = await Subscription.findOne({ user: user._id, status: "active" });
  if (abonnement && abonnement.paymentMethod === "stripe" && abonnement.stripeSubscriptionId) {
    throw new ApiError(
      "Résiliez d'abord votre abonnement Premium : la suppression du compte n'arrête pas le prélèvement.",
      409
    );
  }

  const artist = await Artist.findOne({ user: user._id });
  if (artist) {
    await Promise.all([
      Song.deleteMany({ artist: artist._id }),
      Album.deleteMany({ artist: artist._id }),
      EventModel.deleteMany({ artist: artist._id }),
    ]);
    await artist.deleteOne();
  }

  await Promise.all([
    Playlist.deleteMany({ owner: user._id }),
    Comment.deleteMany({ user: user._id }),
    Notification.deleteMany({ recipient: user._id }),
    RefreshToken.deleteMany({ user: user._id }),
    Subscription.deleteMany({ user: user._id }),
  ]);

  await user.deleteOne();

  return NextResponse.json({ message: "Compte supprimé." });
});
