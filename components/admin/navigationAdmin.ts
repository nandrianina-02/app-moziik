import {
  LayoutDashboard,
  Users,
  Music,
  ShieldCheck,
  Globe,
  type LucideIcon,
} from "lucide-react";

/**
 * La carte de l'administration : cinq sections, et dans chacune ses pages.
 *
 * Une seule rangée de vingt-cinq liens ne se lisait plus : on cherchait la
 * page au lieu de la trouver. Les pages sont donc rangées par métier, et la
 * navigation ne montre que les sections, puis les pages de la section
 * ouverte.
 *
 * Une page porte aussi l'en-tête de son écran : titre et sous-titre vivent
 * ici, pas dans chaque écran, pour que toutes se présentent de la même façon.
 */

export type PageAdmin = { href: string; label: string; titre: string; description: string };
export type SectionAdmin = { label: string; icon: LucideIcon; pages: PageAdmin[] };

export const SECTIONS_ADMIN: SectionAdmin[] = [
  {
    label: "Pilotage",
    icon: LayoutDashboard,
    pages: [
      { href: "/admin", label: "Vue d'ensemble", titre: "Vue d'ensemble", description: "L'activité de la plateforme, et ce qui attend une décision." },
      { href: "/admin/analyses", label: "Analyses", titre: "Analyses", description: "Rapports hebdomadaires et points d'attention." },
      { href: "/admin/taches", label: "Tâches planifiées", titre: "Tâches planifiées", description: "Relancez à la main ce que l'ordonnanceur exécute la nuit." },
    ],
  },
  {
    label: "Catalogue",
    icon: Music,
    pages: [
      { href: "/admin/musiques", label: "Musiques", titre: "Musiques", description: "Le catalogue publié, planifié et en brouillon." },
      { href: "/admin/import", label: "Import", titre: "Import de musiques", description: "Publiez plusieurs morceaux en une seule fois." },
      { href: "/admin/albums", label: "Albums", titre: "Albums", description: "Les disques du catalogue et leurs titres." },
      { href: "/admin/playlists", label: "Playlists", titre: "Playlists", description: "Les sélections publiques et éditoriales." },
      { href: "/admin/selections", label: "Sélections auto", titre: "Sélections automatiques", description: "Les playlists proposées chaque semaine, à valider." },
    ],
  },
  {
    label: "Qualité",
    icon: ShieldCheck,
    pages: [
      { href: "/admin/genres", label: "Genres", titre: "Genres à valider", description: "Les genres proposés par l'analyse, à accepter ou corriger, et les titres encore sans genre." },
      { href: "/admin/doublons", label: "Doublons", titre: "Doublons", description: "Les morceaux importés deux fois, repérés à l'écoute : garder l'un, écarter l'autre." },
      { href: "/admin/annees", label: "Années", titre: "Années de sortie", description: "Les titres datés du jour de leur import, à dater par album." },
      { href: "/admin/paroles", label: "Paroles", titre: "Paroles", description: "Les titres sans paroles ou à caler, et l'atelier de synchronisation." },
      { href: "/admin/bpm", label: "Tempo", titre: "Analyse du tempo", description: "Mesurez le BPM des titres qui n'en ont pas : huit modes d'écoute en dépendent." },
      { href: "/admin/univers", label: "Univers", titre: "Général / Évangélique", description: "Le classement du catalogue en deux univers musicaux." },
    ],
  },
  {
    label: "Communauté",
    icon: Users,
    pages: [
      { href: "/admin/membres", label: "Membres et artistes", titre: "Membres et artistes", description: "Comptes, rôles, vérifications et suspensions." },
      { href: "/admin/messages", label: "Messages", titre: "Messages", description: "Les discussions ouvertes depuis la page de contact." },
      { href: "/admin/commentaires", label: "Commentaires", titre: "Commentaires", description: "Ce que les auditeurs écrivent sous les morceaux." },
      { href: "/admin/annonces", label: "Annonces", titre: "Annonces", description: "Un message de la plateforme, envoyé à tous les membres, aux artistes ou aux abonnés." },
      { href: "/admin/evenements", label: "Évènements", titre: "Évènements", description: "Concerts et sorties annoncés sur la plateforme." },
      { href: "/admin/badges", label: "Badges", titre: "Badges", description: "Distinctions attribuées aux membres et aux artistes." },
    ],
  },
  {
    label: "Site",
    icon: Globe,
    pages: [
      { href: "/admin/accueil", label: "Page d'accueil", titre: "Page d'accueil", description: "Composez les sections vues par les visiteurs." },
      { href: "/admin/aide", label: "Centre d'aide", titre: "Centre d'aide", description: "Les articles publiés sur la page d'aide publique." },
      { href: "/admin/escalades", label: "Questions sans réponse", titre: "Questions sans réponse", description: "Ce sur quoi l'assistant passe la main, et l'article qui manque." },
      { href: "/admin/ia", label: "Assistance IA", titre: "Assistance IA", description: "Fonctionnalités assistées, plafond et consommation." },
      { href: "/admin/parametres", label: "Paramètres", titre: "Paramètres du site", description: "Gérez les réglages globaux de votre plateforme." },
    ],
  },
];

/** `/admin` ne correspond qu'à lui-même : il préfixe toutes les autres pages. */
export function correspond(href: string, chemin: string) {
  return href === "/admin" ? chemin === "/admin" : chemin === href || chemin.startsWith(`${href}/`);
}

/** La section et la page ouvertes ; la vue d'ensemble à défaut. */
export function pageOuverte(chemin: string): { section: SectionAdmin; page: PageAdmin } {
  for (const section of SECTIONS_ADMIN) {
    const page = section.pages.find((p) => correspond(p.href, chemin));
    if (page) return { section, page };
  }
  return { section: SECTIONS_ADMIN[0], page: SECTIONS_ADMIN[0].pages[0] };
}
