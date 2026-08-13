import { Schema, models, model, Types, Model } from "mongoose";

export type HomepagePinnedContentType = "song" | "album" | "artist" | "playlist" | "event" | "custom";

export interface IHomepagePinned {
  contentType: HomepagePinnedContentType;
  // Requis pour tous les types sauf "custom" (bannière libre non liée à
  // un contenu existant : promo, message éditorial...).
  contentId?: Types.ObjectId;
  customTitle?: string;
  customSubtitle?: string;
  customCoverUrl?: string;
  customHref?: string;
  section: string; // section homepage ciblée (ex: "hero", "new_releases")
  priority: number; // plus haut = affiché en premier parmi les épinglés
  startDate?: Date;
  endDate?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const HomepagePinnedSchema = new Schema<IHomepagePinned>({
  contentType: { type: String, enum: ["song", "album", "artist", "playlist", "event", "custom"], required: true },
  contentId: { type: Schema.Types.ObjectId },
  customTitle: { type: String },
  customSubtitle: { type: String },
  customCoverUrl: { type: String },
  customHref: { type: String },
  section: { type: String, required: true, index: true },
  priority: { type: Number, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

HomepagePinnedSchema.index({ section: 1, priority: -1 });

export default (models.HomepagePinned as Model<IHomepagePinned>) ||
  model<IHomepagePinned>("HomepagePinned", HomepagePinnedSchema);
