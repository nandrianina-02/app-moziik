"use client";

import Link from "next/link";
import {
  ChevronRight,
  Database,
  Target,
  Share2,
  Smartphone,
  Clock,
  UserCheck,
  ShieldCheck,
  Baby,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigProvider";

type Section = { id: string; icon: LucideIcon; titre: string; contenu: (ctx: { site: string; email: string }) => React.ReactNode };

/**
 * Politique de confidentialité du site et de l'application Android.
 *
 * Chaque paragraphe décrit ce que le code fait réellement (modèles de
 * données, routes, services tiers branchés) : le Play Store la demande, et
 * une politique qui promet plus ou moins que l'application est pire
 * qu'aucune. À relire quand un service tiers est ajouté ou retiré.
 */
const sections: Section[] = [
  {
    id: "donnees",
    icon: Database,
    titre: "1. Les données que nous recueillons",
    contenu: () => (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Votre compte</strong> : nom, adresse email, nom d&apos;utilisateur et photo de profil. Avec la
          connexion Google, nous recevons votre nom, votre email et votre photo, jamais votre mot de passe Google.
        </li>
        <li>
          <strong>Vos écoutes</strong> : le titre écouté, la durée d&apos;écoute, la date, le type d&apos;appareil et le
          pays déduit de la connexion. Les écoutes sans compte sont enregistrées sans être rattachées à une personne.
        </li>
        <li>
          <strong>Votre activité</strong> : titres aimés, albums enregistrés, artistes suivis, playlists, commentaires et
          messages échangés avec d&apos;autres membres.
        </li>
        <li>
          <strong>Votre abonnement</strong> : formule, dates et état du paiement. Les numéros de carte sont traités par
          Stripe et les paiements MVola par l&apos;opérateur ; ils ne passent pas par nos serveurs.
        </li>
        <li>
          <strong>Sur l&apos;application Android</strong> : un identifiant de notification (pour vous envoyer les
          annonces et alertes), et, en cas de plantage, un rapport technique (modèle du téléphone, version
          d&apos;Android, endroit du code en cause), sans contenu personnel.
        </li>
      </ul>
    ),
  },
  {
    id: "usages",
    icon: Target,
    titre: "2. Ce que nous en faisons",
    contenu: () => (
      <ul className="list-disc space-y-2 pl-5">
        <li>Faire fonctionner le service : connexion, lecture, bibliothèque, messagerie, notifications.</li>
        <li>Vous proposer de la musique : l&apos;accueil, la radio et les recommandations s&apos;appuient sur vos écoutes.</li>
        <li>Rémunérer les artistes : les écoutes complètes servent au calcul de leurs droits.</li>
        <li>Corriger les erreurs de l&apos;application grâce aux rapports de plantage.</li>
      </ul>
    ),
  },
  {
    id: "partage",
    icon: Share2,
    titre: "3. Avec qui elles sont partagées",
    contenu: ({ site }) => (
      <>
        <p>
          {site} ne vend ni ne loue vos données. Elles sont confiées uniquement aux prestataires techniques sans
          lesquels le service ne fonctionne pas :
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>hébergement du site et de la base de données ;</li>
          <li>stockage des fichiers audio et des images ;</li>
          <li>Google (Firebase) pour les notifications et les rapports de plantage de l&apos;application, et pour la connexion Google ;</li>
          <li>Stripe et MVola pour les paiements.</li>
        </ul>
        <p className="mt-2">
          Les artistes voient des statistiques agrégées sur leurs titres (nombre d&apos;écoutes, pays, appareils), jamais
          l&apos;identité de leurs auditeurs.
        </p>
      </>
    ),
  },
  {
    id: "appareil",
    icon: Smartphone,
    titre: "4. Sur votre téléphone",
    contenu: () => (
      <p>
        L&apos;application garde sur le téléphone les titres téléchargés, leurs paroles, les écoutes récentes et vos
        réglages. Ils restent sur l&apos;appareil et sont effacés à la déconnexion (titres téléchargés) ou avec les données
        de l&apos;application. La recherche vocale passe par la reconnaissance vocale du téléphone : l&apos;application ne
        reçoit que le texte reconnu et n&apos;a pas accès au micro.
      </p>
    ),
  },
  {
    id: "conservation",
    icon: Clock,
    titre: "5. Combien de temps",
    contenu: () => (
      <p>
        Les données du compte sont gardées tant que le compte existe. À sa suppression, le profil, les playlists, les
        commentaires, les notifications, l&apos;abonnement et les sessions ouvertes sont effacés, ainsi que le catalogue
        d&apos;un compte artiste. Les écoutes passées restent comptées sans compte associé, car elles servent aux droits
        déjà calculés des artistes ; les messages envoyés restent visibles de leurs destinataires.
      </p>
    ),
  },
  {
    id: "droits",
    icon: UserCheck,
    titre: "6. Vos droits",
    contenu: () => (
      <p>
        Depuis votre compte, vous pouvez à tout moment modifier vos informations, exporter une copie de vos données et
        supprimer votre compte. Pour toute autre demande (accès, rectification, opposition), écrivez-nous à l&apos;adresse
        ci-dessous.
      </p>
    ),
  },
  {
    id: "securite",
    icon: ShieldCheck,
    titre: "7. Sécurité",
    contenu: () => (
      <p>
        Les échanges sont chiffrés (HTTPS). Les mots de passe sont stockés sous forme d&apos;empreinte, jamais en clair, et
        les fichiers audio ne sont servis que par des adresses temporaires.
      </p>
    ),
  },
  {
    id: "enfants",
    icon: Baby,
    titre: "8. Enfants",
    contenu: () => <p>Le service n&apos;est pas destiné aux enfants de moins de 13 ans, qui ne doivent pas créer de compte.</p>,
  },
  {
    id: "contact",
    icon: Mail,
    titre: "9. Nous contacter",
    contenu: ({ email }) => (
      <p>
        Pour toute question sur vos données :{" "}
        <a href={`mailto:${email}`} className="text-accent hover:underline">
          {email}
        </a>
        . Cette politique peut évoluer ; la date de mise à jour figure en haut de la page.
      </p>
    ),
  },
];

const MISE_A_JOUR = "27 octobre 2026";

export default function ConfidentialitePage() {
  const config = useSiteConfig();
  const ctx = { site: config.siteName, email: config.supportEmail || "contact@moziik.app" };
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 md:px-10 md:py-10">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-ink">
          Accueil
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink">Confidentialité</span>
      </nav>
      <header className="mb-8 animate-fade-in-up">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Ce que {ctx.site} recueille, pourquoi, et ce que vous pouvez en faire. Valable pour le site et l&apos;application
          Android. Mise à jour le {MISE_A_JOUR}.
        </p>
      </header>
      <div className="stagger space-y-4">
        {sections.map(({ id, icon: Icone, titre, contenu }) => (
          <section key={id} id={id} className="animate-fade-in-up rounded-xl2 border border-border bg-surface p-5 text-sm leading-relaxed text-ink-muted">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
              <Icone size={17} className="text-accent" />
              {titre}
            </h2>
            {contenu(ctx)}
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        Voir aussi les{" "}
        <Link href="/mentions-legales" className="text-accent hover:underline">
          mentions légales
        </Link>
        .
      </p>
    </div>
  );
}
