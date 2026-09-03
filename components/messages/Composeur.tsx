"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Send, X, Loader2, CornerUpLeft, ImagePlus, Mic, Music2, Square } from "lucide-react";
import { SelecteurContenu } from "@/components/messages/SelecteurContenu";
import { SafeImage } from "@/components/ui/SafeImage";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { useToast } from "@/context/ToastProvider";
import {
  CORPS_MAX,
  dureeCourte,
  ICONES_PARTAGE,
  LIBELLES_PARTAGE,
  PIECES_MAX,
  PIECE_OCTETS_MAX,
  libelleTaille,
  type ContenuPartage,
  type MessageAffiche,
  type PieceJointe,
} from "@/lib/messagerie";

/**
 * La zone de saisie : texte, fichiers, contenu joint, réponse en cours.
 *
 * ENTRÉE ENVOIE, MAJ+ENTRÉE VA À LA LIGNE
 *
 * C'est la convention de toutes les messageries, et la contredire coûte
 * un message envoyé de travers à chaque essai. Sur écran tactile, où il
 * n'y a pas de touche Entrée dédiée, seul le bouton envoie.
 *
 * LES FICHIERS PARTENT DIRECTEMENT CHEZ CLOUDINARY
 *
 * Un mémo vocal d'une minute pèse plus que la charge utile admise par une
 * route Next : il passerait par le serveur pour rien, et échouerait
 * au-delà de quelques mégaoctets. Le navigateur l'envoie donc lui-même,
 * et seule l'adresse obtenue voyage dans le message — c'est déjà ce que
 * fait l'envoi des morceaux (lib/cloudinaryClient.ts).
 *
 * LE MÉMO VOCAL S'ENREGISTRE ICI
 *
 * MediaRecorder, sans bibliothèque. Le bouton n'apparaît que si le
 * navigateur le propose et que la page est servie en HTTPS : proposer un
 * micro qui ne s'ouvrira jamais serait pire que ne rien proposer.
 */

const LIGNES_MAX = 5;
/** Cadence d'annonce de la frappe. La fenêtre serveur est deux fois plus large. */
const SAISIE_MS = 3000;

type PieceEnCours = PieceJointe & { enVol?: boolean };

export function Composeur({
  onEnvoyer,
  onSaisie,
  reponseA,
  onAnnulerReponse,
  desactive,
  placeholder = "Écrivez un message…",
  fichiersAutorises = true,
}: {
  onEnvoyer: (corps: string, partage: ContenuPartage | null, pieces: PieceJointe[]) => Promise<void>;
  /** Prévient le fil que la frappe est en cours. Absent pour l'assistant. */
  onSaisie?: () => void;
  reponseA: MessageAffiche | null;
  onAnnulerReponse: () => void;
  desactive?: boolean;
  placeholder?: string;
  /** Faux dans le fil de l'assistant : il ne saurait pas quoi en faire. */
  fichiersAutorises?: boolean;
}) {
  const pushToast = useToast();
  const [texte, setTexte] = useState("");
  const [partage, setPartage] = useState<ContenuPartage | null>(null);
  const [pieces, setPieces] = useState<PieceEnCours[]>([]);
  const [selecteur, setSelecteur] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [secondes, setSecondes] = useState(0);

  const champ = useRef<HTMLTextAreaElement>(null);
  const fichierImage = useRef<HTMLInputElement>(null);
  const fichierAudio = useRef<HTMLInputElement>(null);
  const enregistreur = useRef<MediaRecorder | null>(null);
  const dernierSignal = useRef(0);

  // Hauteur recalculée à chaque frappe : remise à zéro d'abord, sinon le
  // champ ne rétrécit jamais quand on efface.
  useEffect(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    const ligne = 22;
    el.style.height = `${Math.min(el.scrollHeight, ligne * LIGNES_MAX + 20)}px`;
  }, [texte]);

  useEffect(() => {
    if (reponseA) champ.current?.focus();
  }, [reponseA]);

  // Le chronomètre du mémo vocal, et sa coupure automatique.
  useEffect(() => {
    if (!enregistre) return;
    const tic = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(tic);
  }, [enregistre]);

  const peutEnvoyer =
    (texte.trim().length > 0 || partage !== null || pieces.length > 0) &&
    !envoi &&
    !desactive &&
    !pieces.some((p) => p.enVol);

  function signalerFrappe() {
    if (!onSaisie) return;
    const maintenant = Date.now();
    if (maintenant - dernierSignal.current < SAISIE_MS) return;
    dernierSignal.current = maintenant;
    onSaisie();
  }

  async function televerser(fichier: File, type: "image" | "audio") {
    if (fichier.size > PIECE_OCTETS_MAX) {
      pushToast("error", `« ${fichier.name} » dépasse ${libelleTaille(PIECE_OCTETS_MAX)}.`);
      return;
    }
    if (pieces.length >= PIECES_MAX) {
      pushToast("info", `Pas plus de ${PIECES_MAX} pièces jointes par message.`);
      return;
    }

    // Aperçu immédiat, remplacé quand l'adresse définitive arrive : sans
    // lui, on attend plusieurs secondes devant un composeur inchangé,
    // sans savoir si le fichier a été pris en compte.
    const provisoire: PieceEnCours = {
      type,
      url: URL.createObjectURL(fichier),
      nom: fichier.name,
      taille: fichier.size,
      enVol: true,
    };
    setPieces((prev) => [...prev, provisoire]);

    try {
      const { url, duration } = await uploadToCloudinaryClient(fichier, "messages");
      setPieces((prev) =>
        prev.map((p) =>
          p.url === provisoire.url
            ? { type, url, nom: fichier.name, taille: fichier.size, duree: duration }
            : p
        )
      );
      URL.revokeObjectURL(provisoire.url);
    } catch {
      setPieces((prev) => prev.filter((p) => p.url !== provisoire.url));
      URL.revokeObjectURL(provisoire.url);
      pushToast("error", `Impossible d'envoyer « ${fichier.name} ».`);
    }
  }

  async function basculerMicro() {
    if (enregistre) {
      enregistreur.current?.stop();
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(flux);
      const morceaux: BlobPart[] = [];

      recorder.ondataavailable = (e) => morceaux.push(e.data);
      recorder.onstop = () => {
        // Le micro se rend tout de suite : une pastille d'enregistrement
        // qui reste allumée après coup est un manquement, pas un détail.
        flux.getTracks().forEach((t) => t.stop());
        setEnregistre(false);
        const blob = new Blob(morceaux, { type: recorder.mimeType || "audio/webm" });
        const extension = (recorder.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        void televerser(new File([blob], `memo-${Date.now()}.${extension}`, { type: blob.type }), "audio");
      };

      enregistreur.current = recorder;
      setSecondes(0);
      setEnregistre(true);
      recorder.start();
    } catch {
      pushToast("error", "Le micro n'est pas accessible.");
    }
  }

  async function envoyer() {
    if (!peutEnvoyer) return;
    setEnvoi(true);
    try {
      await onEnvoyer(
        texte.trim(),
        partage,
        pieces.map(({ enVol: _enVol, ...p }) => p)
      );
      setTexte("");
      setPartage(null);
      setPieces([]);
    } finally {
      setEnvoi(false);
    }
  }

  const IconePartage = partage ? ICONES_PARTAGE[partage.type] : null;
  const microDisponible =
    fichiersAutorises &&
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  return (
    <div className="border-t border-border bg-surface px-3 py-2.5 sm:px-4">
      {reponseA && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-accent bg-base px-3 py-2">
          <CornerUpLeft size={14} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-accent">
              Réponse à {reponseA.auteur?.name ?? "un message"}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {reponseA.corps || (reponseA.partage ? reponseA.partage.titre : "Message supprimé")}
            </p>
          </div>
          <button
            type="button"
            onClick={onAnnulerReponse}
            className="rounded-full p-1 text-ink-muted transition-colors hover:bg-surface"
            aria-label="Annuler la réponse"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {pieces.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {pieces.map((p) => (
            <li
              key={p.url}
              className="relative flex items-center gap-2 rounded-xl border border-border bg-base p-1.5 pr-7"
            >
              {p.type === "image" ? (
                <SafeImage src={p.url} alt="" width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Music2 size={18} />
                </span>
              )}
              <span className="max-w-[140px]">
                <span className="block truncate text-xs font-medium">{p.nom}</span>
                <span className="block text-[11px] text-ink-muted">
                  {p.enVol ? "Envoi…" : libelleTaille(p.taille)}
                </span>
              </span>
              {p.enVol && <Loader2 size={13} className="animate-spin text-accent" />}
              <button
                type="button"
                onClick={() => setPieces((prev) => prev.filter((x) => x.url !== p.url))}
                className="absolute right-1 top-1 rounded-full p-0.5 text-ink-muted transition-colors hover:bg-surface"
                aria-label={`Retirer ${p.nom}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {partage && IconePartage && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border bg-base px-3 py-2">
          <IconePartage size={16} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              {LIBELLES_PARTAGE[partage.type]}
            </p>
            <p className="truncate text-sm font-medium">{partage.titre}</p>
          </div>
          <button
            type="button"
            onClick={() => setPartage(null)}
            className="rounded-full p-1 text-ink-muted transition-colors hover:bg-surface"
            aria-label="Retirer le contenu joint"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {enregistre && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
          <p className="flex-1 text-sm font-medium text-danger">
            Enregistrement… {dureeCourte(secondes)}
          </p>
          <button
            type="button"
            onClick={basculerMicro}
            className="flex items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white"
          >
            <Square size={11} /> Arrêter
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setSelecteur(true)}
          disabled={desactive}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          aria-label="Joindre un contenu du catalogue"
          title="Titre, album, playlist, artiste, évènement, radio"
        >
          <Plus size={18} />
        </button>

        {fichiersAutorises && (
          <>
            <button
              type="button"
              onClick={() => fichierImage.current?.click()}
              disabled={desactive || pieces.length >= PIECES_MAX}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50 sm:flex"
              aria-label="Joindre une image"
              title="Joindre une image"
            >
              <ImagePlus size={18} />
            </button>
            {/* Un fichier son déjà enregistré, par opposition au mémo
                dicté sur place. Caché sur téléphone, où le sélecteur de
                fichiers audio du système est rarement utilisable et où le
                micro couvre le besoin. */}
            <button
              type="button"
              onClick={() => fichierAudio.current?.click()}
              disabled={desactive || pieces.length >= PIECES_MAX}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50 sm:flex"
              aria-label="Joindre un fichier audio"
              title="Joindre un fichier audio"
            >
              <Music2 size={18} />
            </button>
            <input
              ref={fichierImage}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void televerser(f, "image");
                e.target.value = "";
              }}
            />
            <input
              ref={fichierAudio}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void televerser(f, "audio");
                e.target.value = "";
              }}
            />
          </>
        )}

        <textarea
          ref={champ}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value.slice(0, CORPS_MAX));
            signalerFrappe();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void envoyer();
            }
          }}
          rows={1}
          disabled={desactive}
          placeholder={placeholder}
          className="selectionnable max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-base px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent disabled:opacity-60"
        />

        {microDisponible && !texte.trim() && pieces.length === 0 && !partage ? (
          <button
            type="button"
            onClick={basculerMicro}
            disabled={desactive}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              enregistre ? "bg-danger text-white" : "bg-accent text-base hover:bg-accent-hover"
            }`}
            aria-label={enregistre ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
          >
            {enregistre ? <Square size={15} /> : <Mic size={17} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={envoyer}
            disabled={!peutEnvoyer}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover disabled:opacity-40"
            aria-label="Envoyer"
          >
            {envoi ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        )}
      </div>

      {selecteur && (
        <SelecteurContenu
          onChoisir={(contenu) => {
            setPartage(contenu);
            setSelecteur(false);
          }}
          onClose={() => setSelecteur(false)}
        />
      )}
    </div>
  );
}
