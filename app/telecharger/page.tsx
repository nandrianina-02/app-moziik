import type { Metadata } from "next";
import { PageTelechargement } from "@/components/telechargement/PageTelechargement";
import { getSiteConfig } from "@/lib/siteConfig";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: `Installer ${config.siteName}`,
    description: `Téléchargez l'application ${config.siteName} pour Android, ou installez le site sur votre écran d'accueil.`,
  };
}

export default function TelechargerPage() {
  return <PageTelechargement />;
}
