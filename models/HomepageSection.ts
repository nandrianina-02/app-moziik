import { Schema, models, model, Model } from "mongoose";
import { SECTION_PAGES, type SectionPage } from "@/lib/sectionPages";
import { MODES, type Mode } from "@/lib/modes";
import { UNIVERS, type Univers } from "@/lib/univers";

export type HomepageSectionType =
  | "hero"
  | "for_you"
  | "recently_played"
  | "new_releases"
  | "top_tracks"
  | "albums"
  | "trending_artists"
  | "recommendations"
  | "playlists"
  | "genres"
  | "events"
  | "radio"
  | "premium"
  | "activity"
  | "custom";

export type HomepageSectionMode = "auto" | "manual";

// Les constantes de pages vivent hors du modèle (lib/sectionPages.ts) :
// l'écran d'admin les lit côté navigateur, et importer ce fichier-ci y
// embarquerait mongoose. Ré-exportées ici par commodité pour le serveur.
export { SECTION_PAGES, SECTION_PAGE_LABEL, type SectionPage } from "@/lib/sectionPages";

export interface IHomepageSectionFilters {
  publicOnly: boolean;
  verifiedOnly: boolean;
  premiumOnly: boolean;
}

export interface IHomepageSection {
  key: HomepageSectionType; // type de section : un des 12 types pilotés par le moteur, ou "custom"
  // Page (ou groupe de pages) sur laquelle la section s'affiche. Absent
  // sur les documents créés avant l'ouverture aux autres pages : ils
  // appartiennent tous à l'accueil, d'où le défaut.
  page: SectionPage;
  // identifiant stable et unique de la section, utilisé pour cibler le contenu épinglé.
  // Sur l'accueil, slug === key pour les types fixes. Ailleurs il est préfixé par la
  // page (ex: "radio:top_tracks") : l'unicité reste globale, donc l'index unique
  // existant en base n'a pas à être reconstruit. Pour "custom", plusieurs sections
  // peuvent coexister, donc slug est généré (ex: "custom-collection-ete").
  slug: string;
  title: string; // libellé affiché, modifiable par l'admin
  /**
   * Section réservée à un univers. Absent : visible des deux côtés.
   *
   * Sans ce champ, la section gospel de la semaine s'afficherait vide
   * dans l'univers général — le moteur écarte bien son contenu, mais le
   * titre et le squelette resteraient là, ce qui se voit.
   */
  univers?: Univers;
  /**
   * Section réservée à un mode d'écoute. Absent : visible quel que soit
   * le mode. C'est ce qui permet d'avoir douze sections « Voyage »,
   * « Sport », « Sommeil »… en base sans que l'accueil en affiche plus
   * d'une à la fois.
   *
   * Nommé `modeEcoute` et non `mode` : ce dernier est pris depuis
   * l'origine par le mode d'alimentation de la section (auto / manuel),
   * qui n'a rien à voir.
   */
  modeEcoute?: Mode;
  enabled: boolean;
  position: number; // ordre d'affichage (drag & drop admin)
  mode: HomepageSectionMode; // auto = alimenté par l'algorithme, manual = uniquement le contenu épinglé
  algorithm: string; // nom de l'algorithme de tri appliqué en mode auto
  limit: number; // nombre d'éléments affichés
  filters: IHomepageSectionFilters;
  createdAt: Date;
  updatedAt: Date;
}

const HomepageSectionSchema = new Schema<IHomepageSection>({
  key: {
    type: String,
    enum: [
      "hero",
      "for_you",
      "recently_played",
      "new_releases",
      "top_tracks",
      "albums",
      "trending_artists",
      "recommendations",
      "playlists",
      "genres",
      "events",
      "radio",
      "premium",
      "activity",
      "custom",
    ],
    required: true,
  },
  page: { type: String, enum: SECTION_PAGES, default: "home", required: true },
  slug: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  univers: { type: String, enum: UNIVERS },
  modeEcoute: { type: String, enum: MODES },
  enabled: { type: Boolean, default: true },
  position: { type: Number, required: true, default: 0 },
  mode: { type: String, enum: ["auto", "manual"], default: "auto" },
  algorithm: { type: String, default: "default" },
  limit: { type: Number, default: 8 },
  filters: {
    publicOnly: { type: Boolean, default: true },
    verifiedOnly: { type: Boolean, default: false },
    premiumOnly: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

HomepageSectionSchema.index({ page: 1, position: 1 });
// Les sections de mode sont nombreuses et lues une à la fois.
HomepageSectionSchema.index({ page: 1, modeEcoute: 1, univers: 1 });

export default (models.HomepageSection as Model<IHomepageSection>) ||
  model<IHomepageSection>("HomepageSection", HomepageSectionSchema);
