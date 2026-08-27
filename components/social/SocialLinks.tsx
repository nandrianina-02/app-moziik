"use client";

import { FaFacebook, FaInstagram, FaYoutube, FaTiktok, FaXTwitter, FaLinkedin, FaWhatsapp, FaTelegram } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { definitionReseau, type LienSocial } from "@/lib/socialPlatforms";

const ICONES: Record<string, IconType> = {
  facebook: FaFacebook,
  instagram: FaInstagram,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  x: FaXTwitter,
  linkedin: FaLinkedin,
  whatsapp: FaWhatsapp,
  telegram: FaTelegram,
};

/**
 * Réseaux sociaux officiels du site.
 *
 * Les aplats de marque sont volontairement identiques dans les deux
 * thèmes : l'exception « logotype » de la WCAG les dispense du rapport de
 * contraste, et un Facebook repeint aux couleurs du site ne serait plus
 * reconnaissable. Le libellé sous l'icône, lui, est du texte normal et
 * suit les tokens du thème.
 *
 * `rel="noopener noreferrer"` sur chaque lien : ces URL sont saisies en
 * administration et sortent du site.
 */
export function SocialLinks({
  liens,
  taille = "normal",
  className = "",
}: {
  liens: LienSocial[];
  /** `compact` : icônes seules, pour un pied de page. */
  taille?: "normal" | "compact";
  className?: string;
}) {
  if (liens.length === 0) return null;

  if (taille === "compact") {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {liens.map((lien) => {
          const def = definitionReseau(lien.platform);
          const Icone = ICONES[lien.platform];
          if (!def || !Icone) return null;
          return (
            <a
              key={lien.platform}
              href={lien.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={def.label}
              title={def.label}
              className="grid h-9 w-9 place-items-center rounded-full text-white transition-transform hover:scale-110"
              style={{ backgroundColor: def.couleur }}
            >
              <Icone size={16} />
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <ul className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${className}`}>
      {liens.map((lien) => {
        const def = definitionReseau(lien.platform);
        const Icone = ICONES[lien.platform];
        if (!def || !Icone) return null;
        return (
          <li key={lien.platform}>
            <a
              href={lien.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-accent"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                style={{ backgroundColor: def.couleur }}
              >
                <Icone size={15} />
              </span>
              <span className="truncate text-sm text-ink">{def.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
