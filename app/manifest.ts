import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/siteConfig";
import { sizedIcon, sizedMaskableIcon } from "@/lib/icons";

// Même remarque que pour /api/site-config : sans ceci, ce fichier de
// métadonnées est généré une fois au build et ne reflèterait jamais un
// changement de logo fait depuis /admin/parametres.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getSiteConfig();

  const icon512 = (config.logoUrl && sizedIcon(config.logoUrl, 512)) || "/icon-512.png";
  const icon192 = (config.logoUrl && sizedIcon(config.logoUrl, 192)) || "/icon-192.png";
  const maskable512 = (config.logoUrl && sizedMaskableIcon(config.logoUrl, 512)) || "/icon-512.png";
  const maskable192 = (config.logoUrl && sizedMaskableIcon(config.logoUrl, 192)) || "/icon-192.png";

  return {
    name: config.siteName,
    short_name: config.siteName,
    description: config.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#0D0F1A",
    theme_color: "#FF6B4A",
    icons: [
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: maskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}
