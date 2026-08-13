// scripts/seed-song.mjs
// Ajoute un artiste de test (si besoin) et un son de test directement en base.
// Usage : node scripts/seed-song.mjs

import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI manquant dans .env / .env.local");
  process.exit(1);
}

// Schémas minimaux inline (évite les soucis d'import TS depuis un script .mjs)
const ArtistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  stageName: { type: String, required: true },
  bio: String,
  coverUrl: String,
  genres: { type: [String], default: [] },
  socialLinks: [{ platform: String, url: String }],
  verified: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  totalPlays: { type: Number, default: 0 },
  monetizationEnabled: { type: Boolean, default: true },
  eventPublishingAuthorized: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const SongSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", required: true },
  featuring: [{ artist: { type: mongoose.Schema.Types.ObjectId, ref: "Artist" }, confirmed: Boolean }],
  album: { type: mongoose.Schema.Types.ObjectId, ref: "Album" },
  audioUrl: { type: String, required: true },
  coverUrl: { type: String, required: true },
  duration: { type: Number, required: true },
  genre: { type: String, required: true },
  lyrics: String,
  explicit: { type: Boolean, default: false },
  status: { type: String, enum: ["draft", "scheduled", "published", "rejected"], default: "draft" },
  releaseDate: { type: Date, required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  playsCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connecté à MongoDB");

  const User = mongoose.models.User || mongoose.model("User", UserSchema);
  const Artist = mongoose.models.Artist || mongoose.model("Artist", ArtistSchema);
  const Song = mongoose.models.Song || mongoose.model("Song", SongSchema);

  // ⚠️ Remplace par l'email de ton compte admin/artiste existant
  const OWNER_EMAIL = "nandrianina.nd.54@gmail.com";

  const user = await User.findOne({ email: OWNER_EMAIL });
  if (!user) {
    console.error(`Aucun utilisateur trouvé avec l'email ${OWNER_EMAIL}. Modifie OWNER_EMAIL dans le script.`);
    process.exit(1);
  }

  // Trouve ou crée un profil artiste lié à cet utilisateur
  let artist = await Artist.findOne({ user: user._id });
  if (!artist) {
    artist = await Artist.create({
      user: user._id,
      stageName: "Artiste Test",
      genres: ["Test"],
      verified: true,
      eventPublishingAuthorized: true,
    });
    console.log("Artiste de test créé :", artist._id.toString());
  }

  const song = await Song.create({
    title: "Son de test",
    artist: artist._id,
    audioUrl: "https://res.cloudinary.com/di6euh2z5/video/upload/v1776158528/moozik/audio/mt5dxnxozckwk0cbkblr.mp3", // ⚠️ remplace par une vraie URL Cloudinary
    coverUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg", // ⚠️ remplace par une vraie URL Cloudinary
    duration: 180,
    genre: "Test",
    status: "published",
    releaseDate: new Date(),
    publishedBy: user._id,
    approvedBy: user._id,
  });

  console.log("Son créé :", song._id.toString());
  console.log("Titre :", song.title);

  await mongoose.disconnect();
  console.log("Terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
