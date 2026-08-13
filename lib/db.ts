import mongoose from "mongoose";

// Volontairement lu paresseusement dans connectDB() plutôt qu'au chargement
// du module : ce fichier est importé par la quasi-totalité des routes API,
// et Next.js importe les modules de route pendant "Collecting page data" à
// la construction. Un throw ici crashait tout le build Vercel dès que
// MONGODB_URI manquait dans l'environnement de build.
function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("La variable d'environnement MONGODB_URI est manquante.");
  }
  return uri;
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// En dev, Next.js recharge les modules à chaud : on met le cache sur
// globalThis pour éviter d'ouvrir une nouvelle connexion à chaque requête.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectDB() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
