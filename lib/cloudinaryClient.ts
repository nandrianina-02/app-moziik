// Upload direct navigateur → Cloudinary via un upload preset non-signé.
// Nécessaire pour les fichiers audio (souvent plusieurs Mo), qui
// dépasseraient la limite de taille de payload d'une route API Next.js.
//
// Config Cloudinary requise (dashboard Cloudinary) :
// créer un "Upload preset" en mode "Unsigned", puis renseigner
// NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME et NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.

export async function uploadToCloudinaryClient(
  file: File,
  folder: "songs" | "videos" | "covers" | "avatars" | "banners" | "site-assets" | "contact-attachments",
  onProgress?: (percent: number) => void
): Promise<{ url: string; duration?: number }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Configuration Cloudinary manquante (variables NEXT_PUBLIC_*).");
  }

  // Cloudinary range l'audio et la vidéo sous le même type de ressource.
  const resourceType = folder === "songs" || folder === "videos" ? "video" : "image";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `moziik/${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, duration: data.duration });
      } else {
        reject(new Error("Échec de l'envoi du fichier vers Cloudinary."));
      }
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'envoi du fichier."));
    xhr.send(formData);
  });
}
