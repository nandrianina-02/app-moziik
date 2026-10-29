import { Radar, Sparkles } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * La pochette d'une sélection personnelle, dessinée plutôt que tirée d'un
 * fichier, comme celles des sélections de Spotify :
 * - un mix : la photo de son artiste principal, un bandeau « Mix du jour »
 *   et son numéro, dans la couleur propre à ce mix ;
 * - les Découvertes de la semaine et le Radar des sorties : un visuel fixe,
 *   reconnaissable d'une semaine à l'autre.
 *
 * Une pochette est un objet : ses couleurs ne suivent pas le thème du
 * visiteur (même règle que lib/defaultCover.ts).
 */

/** Une couleur par mix, toujours la même pour un même numéro : on reconnaît son Mix 2. */
const COULEURS_MIX = ["#A78BFA", "#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#22D3EE"];

export type DonneesPochette = {
  type: "mix" | "decouvertes" | "radar";
  rang: number;
  genre?: string;
  couverture?: string;
  /** Vrai pour les mix d'un compte (« Mix du jour »), faux pour ceux d'un visiteur (le genre). */
  personnel: boolean;
};

export function PochetteSelection({ s, grande = false }: { s: DonneesPochette; grande?: boolean }) {
  if (s.type === "decouvertes") {
    return (
      <div className="relative grid aspect-square w-full place-items-end overflow-hidden rounded-md bg-[#F84A26] p-[8%] text-[#0D0F1A]">
        <Sparkles aria-hidden className="absolute right-[8%] top-[8%] h-[22%] w-[22%] opacity-90" />
        <p className={`w-full font-display font-bold leading-[0.95] tracking-tight ${grande ? "text-4xl" : "text-[clamp(1rem,2.2vw,1.6rem)]"}`}>
          Découvertes de la semaine
        </p>
      </div>
    );
  }
  if (s.type === "radar") {
    return (
      <div className="relative grid aspect-square w-full place-items-end overflow-hidden rounded-md bg-[#111827] p-[8%] text-white">
        <span aria-hidden className="absolute -right-[25%] -top-[25%] h-[90%] w-[90%] rounded-full border-2 border-[#F84A26]/70" />
        <span aria-hidden className="absolute -right-[5%] -top-[5%] h-[50%] w-[50%] rounded-full border-2 border-[#F84A26]/90" />
        <Radar aria-hidden className="absolute right-[10%] top-[10%] h-[18%] w-[18%] text-[#F84A26]" />
        <p className={`w-full font-display font-bold leading-[0.95] tracking-tight ${grande ? "text-4xl" : "text-[clamp(1rem,2.2vw,1.6rem)]"}`}>
          Radar des sorties
        </p>
      </div>
    );
  }

  const couleur = COULEURS_MIX[(Math.max(1, s.rang) - 1) % COULEURS_MIX.length];
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-[#1F2433]">
      {s.couverture && <SafeImage src={s.couverture} alt="" width={grande ? 320 : 200} height={grande ? 320 : 200} className="h-full w-full object-cover" />}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute left-0 top-[6%] h-[3%] w-[14%]" style={{ backgroundColor: couleur }} aria-hidden />
      <div className="absolute inset-x-[6%] bottom-[6%] flex items-end justify-between gap-1">
        <span
          className={`truncate px-1.5 py-0.5 font-display font-bold leading-none text-[#0D0F1A] ${grande ? "text-lg" : "text-[clamp(0.6rem,1.1vw,0.85rem)]"}`}
          style={{ backgroundColor: couleur }}
        >
          {s.personnel ? "Mix du jour" : s.genre ?? "Mix"}
        </span>
        <span
          className={`px-1.5 font-display font-bold leading-none text-[#0D0F1A] ${grande ? "text-5xl" : "text-[clamp(1.1rem,2.4vw,1.9rem)]"}`}
          style={{ backgroundColor: couleur }}
        >
          {String(s.rang).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
