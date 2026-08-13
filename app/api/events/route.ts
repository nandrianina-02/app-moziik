import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Event from "@/models/Event";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const GET = withApiErrors(async () => {
  await connectDB();
  const events = await Event.find({ status: "published" })
    .populate("artist", "stageName verified")
    .sort({ date: 1 });
  return NextResponse.json({ events });
});

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  const { title, description, coverUrl, location, date, ticketUrl, price } = await req.json();
  if (!title || !description || !location || !date) {
    throw new ApiError("Champs obligatoires manquants.");
  }

  await connectDB();

  let artistId: string | undefined;
  let status: "pending" | "published" = "pending";

  if (session.user.role === "admin") {
    status = "published"; // un évènement créé par un admin est publié directement
  } else if (session.user.role === "artist") {
    const artist = await Artist.findOne({ user: session.user.id });
    if (!artist?.eventPublishingAuthorized) {
      throw new ApiError("Tu n'es pas encore autorisé à publier des évènements.", 403);
    }
    artistId = artist._id.toString();
    status = "pending"; // passe par une validation admin
  } else {
    throw new ApiError("Seuls les admins et artistes autorisés peuvent créer un évènement.", 403);
  }

  const event = await Event.create({
    title,
    description,
    coverUrl,
    location,
    date,
    ticketUrl,
    price,
    artist: artistId,
    createdBy: session.user.id,
    status,
  });

  return NextResponse.json({ event }, { status: 201 });
});
