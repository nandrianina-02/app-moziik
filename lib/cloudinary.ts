import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload un fichier (buffer base64 ou chemin) vers Cloudinary.
 * `folder` permet de séparer sons / covers / logos / avatars.
 */
export async function uploadToCloudinary(
  file: string,
  folder: "songs" | "covers" | "avatars" | "site-assets",
  resourceType: "video" | "image" = "image" // Cloudinary traite l'audio via "video"
) {
  return cloudinary.uploader.upload(file, {
    folder: `moziik/${folder}`,
    resource_type: resourceType,
  });
}

export default cloudinary;
