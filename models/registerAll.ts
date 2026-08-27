/**
 * Enregistre TOUS les schémas Mongoose, pour leurs seuls effets de bord.
 *
 * Pourquoi c'est nécessaire — et pourquoi le bug ne se voyait qu'en
 * production : `populate("songs")` demande à Mongoose de résoudre le
 * modèle référencé (`ref: "Song"`) dans son registre global. Ce registre
 * n'est peuplé que par l'*import* du fichier du modèle.
 *
 * En développement, tout tourne dans un processus unique : une autre
 * route ayant déjà importé `Song`, le registre était complet et le
 * populate fonctionnait. Sur Vercel, chaque route est empaquetée
 * séparément : le bundle de `/api/playlists/[id]` ne contenait ni `Song`
 * ni `User` (vérifiable dans .next/server/app/api/.../route.js), et le
 * populate levait `MissingSchemaError` — un 500 impossible à reproduire
 * en local.
 *
 * Importé par lib/db.ts, donc garanti sur toute route appelant
 * `connectDB()`. Le coût est nul à l'exécution : ce sont des définitions
 * de schémas, pas des connexions.
 */
import "@/models/AiUsage";
import "@/models/Album";
import "@/models/Artist";
import "@/models/Badge";
import "@/models/Comment";
import "@/models/Event";
import "@/models/HelpArticle";
import "@/models/HomepageHubCard";
import "@/models/HomepagePinned";
import "@/models/HomepageSection";
import "@/models/HomepageSettings";
import "@/models/HomepageStats";
import "@/models/Notification";
import "@/models/Play";
import "@/models/Playlist";
import "@/models/RefreshToken";
import "@/models/Royalty";
import "@/models/SiteConfig";
import "@/models/Song";
import "@/models/SupportMessage";
import "@/models/SupportThread";
import "@/models/Subscription";
import "@/models/User";
