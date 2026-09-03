"use client";

import Link from "next/link";
import { Play, ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { resoudreStation } from "@/lib/radios";
import {
  ACTIONS_PARTAGE,
  ICONES_PARTAGE,
  LIBELLES_PARTAGE,
  type ContenuPartage,
} from "@/lib/messagerie";

/**
 * Le contenu partagé, tel qu'il apparaît dans une bulle.
 *
 * CE QUE FAIT LE BOUTON EST CE QU'IL ANNONCE
 *
 * « Écouter » lance le morceau sur place ; « Ouvrir l'album » va sur la
 * page. Un bouton unique qui aurait toujours navigué aurait été plus
 * simple à écrire, et aurait obligé à quitter la conversation pour
 * entendre trois secondes du titre qu'on vient de recevoir — c'est-à-dire
 * à perdre le fil de la discussion à chaque partage.
 *
 * Ce que le bouton ne fait pas : deviner. Une radio se lance parce que sa
 * clé désigne une station réelle (lib/radios.ts) ; un évènement ou un
 * artiste ne se « joue » pas, et sa carte ne prétend pas le contraire.
 *
 * LA CARTE SURVIT À CE QU'ELLE DÉCRIT
 *
 * Titre, sous-titre et image ont été recopiés à l'envoi. Un morceau
 * retiré du catalogue laisse donc une carte lisible, dont seul le lien ne
 * mène plus nulle part — ce que la page de destination dira mieux qu'une
 * carte vide.
 */
export function CartePartage({ partage, aMoi }: { partage: ContenuPartage; aMoi: boolean }) {
  const { playQueue } = usePlayer();
  const pushToast = useToast();
  const [chargement, setChargement] = useState(false);

  const Icone = ICONES_PARTAGE[partage.type];
  const jouable = partage.type === "song" || partage.type === "radio";

  // Sur fond d'accent (mes propres bulles), les tokens d'encre habituels
  // ne se lisent plus : la carte reprend alors le blanc de la bulle.
  const cadre = aMoi
    ? "border-white/25 bg-white/10 hover:bg-white/15"
    : "border-border bg-base hover:bg-surface";
  const titreClasse = aMoi ? "text-white" : "text-ink";
  const detailClasse = aMoi ? "text-white/70" : "text-ink-muted";

  async function lancer() {
    setChargement(true);
    try {
      if (partage.type === "song") {
        const res = await fetch(`/api/songs/${partage.refId}`);
        if (!res.ok) throw new Error();
        const { song } = (await res.json()) as { song: PlayableSong };
        playQueue([song], 0, { type: "song", label: song.title, id: song._id });
        return;
      }

      const station = resoudreStation(partage.refId);
      if (!station) throw new Error();
      const res = await fetch(station.fetchUrl);
      if (!res.ok) throw new Error();
      const { songs } = (await res.json()) as { songs: PlayableSong[] };
      if (!songs?.length) {
        pushToast("info", "Cette station n'a aucun titre pour le moment.");
        return;
      }
      playQueue(songs, 0, { type: "radio", label: station.label, genre: station.genre });
    } catch {
      pushToast("error", "Ce contenu n'est plus disponible.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className={`mt-1 w-full overflow-hidden rounded-xl border transition-colors ${cadre}`}>
      <div className="flex items-center gap-3 p-2.5">
        <span className="relative shrink-0">
          {partage.imageUrl ? (
            <SafeImage
              src={partage.imageUrl}
              alt=""
              width={56}
              height={56}
              className={`h-14 w-14 object-cover ${partage.type === "artist" ? "rounded-full" : "rounded-lg"}`}
            />
          ) : (
            <span
              className={`flex h-14 w-14 items-center justify-center ${
                aMoi ? "bg-white/15 text-white" : "bg-accent/10 text-accent"
              } ${partage.type === "artist" ? "rounded-full" : "rounded-lg"}`}
            >
              <Icone size={22} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${detailClasse}`}>
            <Icone size={11} className="shrink-0" />
            {LIBELLES_PARTAGE[partage.type]}
          </p>
          <p className={`truncate text-sm font-semibold ${titreClasse}`}>{partage.titre}</p>
          {partage.sousTitre && (
            <p className={`truncate text-xs ${detailClasse}`}>{partage.sousTitre}</p>
          )}
        </div>
      </div>

      <div className={`flex items-center gap-2 border-t px-2.5 py-2 ${aMoi ? "border-white/20" : "border-border"}`}>
        {jouable && (
          <button
            type="button"
            onClick={lancer}
            disabled={chargement}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
              aMoi ? "bg-white text-accent hover:bg-white/90" : "bg-accent text-base hover:bg-accent/90"
            }`}
          >
            {chargement ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {ACTIONS_PARTAGE[partage.type]}
          </button>
        )}

        <Link
          href={partage.chemin}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            jouable
              ? aMoi
                ? "text-white/80 hover:bg-white/10"
                : "text-ink-muted hover:bg-surface"
              : aMoi
                ? "bg-white text-accent hover:bg-white/90"
                : "bg-accent text-base hover:bg-accent/90"
          }`}
        >
          {jouable ? "Ouvrir la fiche" : ACTIONS_PARTAGE[partage.type]}
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}
