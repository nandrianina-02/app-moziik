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

// mongoose.connection.readyState
const DISCONNECTED = 0;
const CONNECTED = 1;
const CONNECTING = 2;

export async function connectDB() {
  // On ne se fie plus à la seule présence de `cache.conn` : l'objet reste
  // en cache alors que la connexion sous-jacente a pu tomber (mise en
  // veille d'une instance serverless, coupure réseau, bascule Atlas).
  // Comme `bufferCommands: false` empêche toute mise en attente, chaque
  // requête échouait alors par « Client must be connected before running
  // operations » — donc par un 500 opaque — et ce définitivement, jusqu'au
  // redémarrage du processus. Symptôme typique : la navigation continue de
  // fonctionner (pages en cache) mais plus aucun ajout ni modification ne
  // passe.
  if (cache.conn && mongoose.connection.readyState === CONNECTED) return cache.conn;

  // `CONNECTING` : une tentative est déjà en vol, on attend la même
  // promesse. Tout autre état signifie que le cache est périmé.
  if (mongoose.connection.readyState !== CONNECTING) {
    cache.conn = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(getMongoUri(), { bufferCommands: false })
      .catch((err) => {
        // Sans cette remise à zéro, la promesse *rejetée* restait en cache
        // et toutes les requêtes suivantes la ré-attendaient : une seule
        // seconde d'indisponibilité réseau condamnait l'instance entière.
        cache.promise = null;
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/**
 * Vrai pour les pannes d'infrastructure (base injoignable, connexion
 * perdue, sélection de serveur expirée) — par opposition à une erreur de
 * données. Permet de répondre 503 « réessaie » plutôt qu'un 500 qui
 * laisse croire à un bug applicatif. Voir lib/apiError.ts.
 */
export function isDatabaseUnavailableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (mongoose.connection.readyState === DISCONNECTED && /must be connected/i.test(err.message)) {
    return true;
  }
  return (
    err.name === "MongoNetworkError" ||
    err.name === "MongoNotConnectedError" ||
    err.name === "MongooseServerSelectionError" ||
    err.name === "MongoServerSelectionError" ||
    err.message.includes("MONGODB_URI")
  );
}
