/**
 * Ce que chaque dossier d'envoi accepte. Partagé par le navigateur, qui
 * refuse un fichier avant de le lire, et par le serveur, qui fait foi.
 *
 * Les noms de dossiers sont ceux de Cloudinary : les fichiers migrés et les
 * nouveaux se rangent aux mêmes endroits.
 */
export const DOSSIERS_ENVOI = [
  "songs",
  "videos",
  "covers",
  "avatars",
  "banners",
  "site-assets",
  "contact-attachments",
  "messages",
] as const;

export type DossierEnvoi = (typeof DOSSIERS_ENVOI)[number];

const MO = 1024 * 1024;
const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

interface Regle {
  types: string[];
  tailleMax: number;
  messageType: string;
  /** Ouvert aux visiteurs sans compte. */
  anonyme?: boolean;
  /** Réservé à l'administration. */
  admin?: boolean;
}

const REGLES: Record<DossierEnvoi, Regle> = {
  songs: {
    types: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/opus"],
    tailleMax: 300 * MO,
    messageType: "Format audio non accepté : MP3, WAV, FLAC, M4A, AAC ou OGG.",
  },
  videos: {
    types: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
    tailleMax: 1024 * MO,
    messageType: "Format vidéo non accepté : MP4, MOV ou WebM.",
  },
  covers: { types: IMAGES, tailleMax: 20 * MO, messageType: "Format d'image non accepté : JPEG, PNG, WebP, GIF ou AVIF." },
  avatars: { types: IMAGES, tailleMax: 10 * MO, messageType: "Format d'image non accepté : JPEG, PNG, WebP, GIF ou AVIF." },
  banners: { types: IMAGES, tailleMax: 20 * MO, messageType: "Format d'image non accepté : JPEG, PNG, WebP, GIF ou AVIF." },
  "site-assets": {
    types: [...IMAGES, "image/svg+xml"],
    tailleMax: 20 * MO,
    messageType: "Format d'image non accepté : JPEG, PNG, WebP, GIF, AVIF ou SVG.",
    admin: true,
  },
  "contact-attachments": {
    types: ["application/pdf", "image/jpeg", "image/png"],
    tailleMax: 10 * MO,
    messageType: "Pièce jointe non acceptée : PDF, JPEG ou PNG.",
    anonyme: true,
  },
  messages: {
    types: [...IMAGES, "audio/"],
    tailleMax: 50 * MO,
    messageType: "Pièce jointe non acceptée : une image ou un enregistrement audio.",
  },
};

export function regleEnvoi(dossier: DossierEnvoi): Regle {
  return REGLES[dossier];
}

/** Extension attendue par le stockage pour un type déclaré. */
const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export function extensionPourType(type: string): string | null {
  return EXTENSIONS[type.split(";")[0].trim().toLowerCase()] ?? null;
}
