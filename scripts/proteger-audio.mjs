/**
 * Rend les fichiers audio déjà en ligne inaccessibles par leur adresse
 * publique.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Les morceaux ont été envoyés chez Cloudinary avec un préréglage non
 * signé : ils sont donc distribués en type `upload`, c'est-à-dire
 * publiquement, pour qui connaît l'adresse. Le plafond de qualité et le
 * quota des visiteurs se contournaient en la lisant dans l'onglet réseau
 * du navigateur.
 *
 * Ce script bascule chaque fichier en type `authenticated`. L'adresse
 * d'origine cesse alors de répondre, et seule une adresse signée par le
 * serveur — celle que `/api/stream/<id>` fabrique — fonctionne. Une
 * adresse retouchée à la main pour passer de 128 à 320 kb/s échoue sur la
 * signature.
 *
 * CE QU'IL NE TOUCHE PAS
 *
 * La base de données. L'identifiant Cloudinary d'un fichier ne change pas
 * avec son type de distribution, et `lib/cloudinaryAudio.ts` reconstruit
 * l'adresse à partir de cet identifiant : les documents `Song` restent
 * valables tels quels.
 *
 * L'ORDRE DES OPÉRATIONS COMPTE
 *
 *   1. Dans le tableau de bord Cloudinary, régler le préréglage d'envoi
 *      (celui de NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) sur
 *      « Delivery type: authenticated », pour que les PROCHAINS envois
 *      soient protégés d'emblée.
 *   2. Lancer ce script, pour les fichiers DÉJÀ en ligne.
 *   3. Poser CLOUDINARY_AUDIO_AUTHENTICATED=true et redéployer.
 *
 * Inverser 2 et 3 rendrait le catalogue muet entre les deux.
 *
 * Idempotent : un fichier déjà en `authenticated` est simplement compté et
 * passé.
 *
 * Usage :
 *   node scripts/proteger-audio.mjs --essai   (n'écrit rien, montre ce qui serait fait)
 *   node scripts/proteger-audio.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

// Les variables vivent dans .env.local, que Node ne lit pas tout seul.
for (const fichier of [".env.local", ".env"]) {
  const chemin = path.resolve(process.cwd(), fichier);
  if (!fs.existsSync(chemin)) continue;
  for (const ligne of fs.readFileSync(chemin, "utf8").split("\n")) {
    const trouve = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!trouve) continue;
    const [, cle, valeur = ""] = trouve;
    if (!process.env[cle]) process.env[cle] = valeur.replace(/^["']|["']$/g, "");
  }
}

const ESSAI = process.argv.includes("--essai");
const DOSSIER = "moziik/songs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

if (!process.env.CLOUDINARY_API_SECRET) {
  console.error("CLOUDINARY_API_SECRET manquante — impossible de parler à Cloudinary.");
  process.exit(1);
}

async function main() {
  console.log(ESSAI ? "Essai : rien ne sera modifié.\n" : "Bascule en type « authenticated ».\n");

  let curseur;
  let vus = 0;
  let bascules = 0;
  let echecs = 0;

  do {
    const page = await cloudinary.api.resources({
      resource_type: "video",
      type: "upload",
      prefix: DOSSIER,
      max_results: 100,
      next_cursor: curseur,
    });

    for (const fichier of page.resources) {
      vus++;
      if (ESSAI) {
        console.log(`  → ${fichier.public_id}`);
        bascules++;
        continue;
      }

      try {
        await cloudinary.uploader.rename(fichier.public_id, fichier.public_id, {
          resource_type: "video",
          type: "upload",
          to_type: "authenticated",
          // Sans invalidation, les serveurs de cache de Cloudinary
          // continueraient de servir l'ancienne adresse publique pendant
          // des heures.
          invalidate: true,
        });
        bascules++;
        console.log(`  ✓ ${fichier.public_id}`);
      } catch (err) {
        echecs++;
        console.warn(`  ✗ ${fichier.public_id} — ${err?.message ?? err}`);
      }
    }

    curseur = page.next_cursor;
  } while (curseur);

  console.log(
    `\n${vus} fichier(s) en type « upload » trouvé(s), ${bascules} ${ESSAI ? "à basculer" : "basculé(s)"}` +
      (echecs > 0 ? `, ${echecs} en échec.` : ".")
  );

  if (!ESSAI && bascules > 0) {
    console.log("\nPose maintenant CLOUDINARY_AUDIO_AUTHENTICATED=true et redéploie.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
