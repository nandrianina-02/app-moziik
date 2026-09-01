"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Search, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import type { ArtisteAffiche, CategorieBillet, MomentProgramme } from "@/components/events/detail/types";

/**
 * Les champs de la fiche détaillée d'un évènement.
 *
 * Regroupés ici pour que la page de modification reste lisible, et pour
 * qu'un même champ — une liste de phrases, une grille d'horaires — se
 * comporte partout de la même façon.
 */

function Etiquette({ children, aide }: { children: React.ReactNode; aide?: string }) {
  return (
    <div className="mb-1.5">
      <span className="block text-sm text-ink-muted">{children}</span>
      {aide && <span className="mt-0.5 block text-xs text-ink-muted/70">{aide}</span>}
    </div>
  );
}

const CHAMP =
  "w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent";

function BoutonRetirer({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <X size={14} />
    </button>
  );
}

/** Une liste de courtes phrases : pastilles, puces, bon à savoir. */
export function ChampsListe({
  label,
  aide,
  placeholder,
  valeurs,
  onChange,
  max = 12,
}: {
  label: string;
  aide?: string;
  placeholder: string;
  valeurs: string[];
  onChange: (valeurs: string[]) => void;
  max?: number;
}) {
  const [saisie, setSaisie] = useState("");

  function ajouter() {
    const texte = saisie.trim();
    // Le doublon est refusé silencieusement : la liste sert de clé
    // d'affichage côté fiche, deux entrées identiques s'y superposeraient.
    if (!texte || valeurs.includes(texte) || valeurs.length >= max) return;
    onChange([...valeurs, texte]);
    setSaisie("");
  }

  return (
    <div>
      <Etiquette aide={aide}>{label}</Etiquette>

      {valeurs.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {valeurs.map((valeur) => (
            <li
              key={valeur}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-3 pr-1 text-xs"
            >
              <span>{valeur}</span>
              <button
                type="button"
                onClick={() => onChange(valeurs.filter((v) => v !== valeur))}
                aria-label={`Retirer ${valeur}`}
                className="grid h-5 w-5 place-items-center rounded-full text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            // Entrée ajoute la ligne sans soumettre le formulaire entier.
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder={placeholder}
          maxLength={200}
          className={CHAMP}
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={valeurs.length >= max}
          aria-label={`Ajouter à « ${label} »`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/** Le déroulé, heure par heure. */
export function ChampsProgramme({
  moments,
  onChange,
}: {
  moments: MomentProgramme[];
  onChange: (moments: MomentProgramme[]) => void;
}) {
  function modifier(index: number, champ: keyof MomentProgramme, valeur: string) {
    onChange(moments.map((m, i) => (i === index ? { ...m, [champ]: valeur } : m)));
  }

  return (
    <div>
      <Etiquette aide="Laissé vide, le programme n'apparaît pas sur la fiche.">Programme</Etiquette>

      <div className="space-y-2">
        {moments.map((moment, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              value={moment.time}
              onChange={(e) => modifier(index, "time", e.target.value)}
              placeholder="18:00"
              maxLength={20}
              className={`${CHAMP} w-24 shrink-0`}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                value={moment.title}
                onChange={(e) => modifier(index, "title", e.target.value)}
                placeholder="Ouverture des portes"
                maxLength={120}
                className={CHAMP}
              />
              <input
                value={moment.detail ?? ""}
                onChange={(e) => modifier(index, "detail", e.target.value)}
                placeholder="Précision (optionnel)"
                maxLength={300}
                className={CHAMP}
              />
            </div>
            <BoutonRetirer
              label={`Retirer le moment ${index + 1}`}
              onClick={() => onChange(moments.filter((_, i) => i !== index))}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...moments, { time: "", title: "" }])}
        className="mt-2 flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus size={14} /> Ajouter un moment
      </button>
    </div>
  );
}

/** Les catégories de billets, telles qu'elles s'affichent dans la colonne de droite. */
export function ChampsBillets({
  billets,
  onChange,
  devise,
}: {
  billets: CategorieBillet[];
  onChange: (billets: CategorieBillet[]) => void;
  devise: string;
}) {
  function modifier(index: number, valeurs: Partial<CategorieBillet>) {
    onChange(billets.map((b, i) => (i === index ? { ...b, ...valeurs } : b)));
  }

  return (
    <div>
      <Etiquette aide={`Prix en ${devise}. Moziik n'encaisse rien : l'achat se fait sur le lien de billetterie.`}>
        Catégories de billets
      </Etiquette>

      <div className="space-y-3">
        {billets.map((billet, index) => (
          <div key={index} className="rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <input
                value={billet.name}
                onChange={(e) => modifier(index, { name: e.target.value })}
                placeholder="Standard"
                maxLength={60}
                className={CHAMP}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={Number.isFinite(billet.price) ? billet.price : ""}
                onChange={(e) => modifier(index, { price: Number(e.target.value) })}
                placeholder="0"
                className={`${CHAMP} w-28 shrink-0`}
              />
              <BoutonRetirer
                label={`Retirer la catégorie ${index + 1}`}
                onClick={() => onChange(billets.filter((_, i) => i !== index))}
              />
            </div>

            <input
              value={billet.description ?? ""}
              onChange={(e) => modifier(index, { description: e.target.value })}
              placeholder="Ce que la place donne (optionnel)"
              maxLength={160}
              className={`${CHAMP} mt-2`}
            />

            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={billet.originalPrice ?? ""}
                onChange={(e) =>
                  modifier(index, {
                    originalPrice: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="Prix barré"
                className={CHAMP}
              />
              <input
                type="date"
                value={billet.availableUntil?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  modifier(index, { availableUntil: e.target.value ? e.target.value : undefined })
                }
                className={CHAMP}
              />
            </div>

            <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={Boolean(billet.soldOut)}
                onChange={(e) => modifier(index, { soldOut: e.target.checked })}
                className="accent-accent"
              />
              Complet
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...billets, { name: "", price: 0 }])}
        className="mt-2 flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus size={14} /> Ajouter une catégorie
      </button>
    </div>
  );
}

/** Les photos supplémentaires, envoyées une par une sur Cloudinary. */
export function ChampsGalerie({
  urls,
  onChange,
  max = 20,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const pushToast = useToast();
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function envoyer(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    setEnvoiEnCours(true);
    try {
      const restant = max - urls.length;
      const lot = Array.from(fichiers).slice(0, restant);
      const envoyes = await Promise.all(lot.map((f) => uploadToCloudinaryClient(f, "covers")));
      onChange([...urls, ...envoyes.map((e) => e.url)]);
    } catch {
      pushToast("error", "L'envoi d'une photo a échoué.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div>
      <Etiquette aide="Elles apparaissent en miniatures sous l'affiche.">Galerie</Etiquette>

      {urls.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {urls.map((url) => (
            <li key={url} className="relative">
              <div className="h-16 w-24 overflow-hidden rounded-lg bg-base">
                <SafeImage src={url} alt="" width={96} height={64} className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                aria-label="Retirer cette photo"
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-ink-muted transition-colors hover:border-accent">
        <ImagePlus size={15} />
        {envoiEnCours ? "Envoi..." : urls.length >= max ? "Galerie complète" : "Ajouter des photos"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={envoiEnCours || urls.length >= max}
          className="hidden"
          onChange={(e) => {
            envoyer(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

/** Les artistes à l'affiche, cherchés dans le catalogue. */
export function SelecteurArtistes({
  selection,
  onChange,
}: {
  selection: ArtisteAffiche[];
  onChange: (artistes: ArtisteAffiche[]) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ArtisteAffiche[]>([]);
  const dernier = useRef(0);

  useEffect(() => {
    const terme = recherche.trim();
    if (terme.length < 2) {
      setResultats([]);
      return;
    }

    // Anti-rebond : la recherche part 300 ms après la dernière frappe, et
    // une réponse doublée par une plus récente est ignorée.
    const jeton = ++dernier.current;
    const minuteur = setTimeout(() => {
      fetch(`/api/artists?search=${encodeURIComponent(terme)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (jeton === dernier.current) setResultats(data?.artists ?? []);
        })
        .catch(() => {
          if (jeton === dernier.current) setResultats([]);
        });
    }, 300);

    return () => clearTimeout(minuteur);
  }, [recherche]);

  function ajouter(artiste: ArtisteAffiche) {
    if (selection.some((a) => a._id === artiste._id)) return;
    onChange([...selection, artiste]);
    setRecherche("");
    setResultats([]);
  }

  return (
    <div>
      <Etiquette aide="En plus de l'artiste qui porte l'évènement, déjà affiché.">
        Artistes à l&apos;affiche
      </Etiquette>

      {selection.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selection.map((artiste) => (
            <li
              key={artiste._id}
              className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1.5 pr-1 text-xs"
            >
              <span className="h-6 w-6 overflow-hidden rounded-full bg-base">
                <SafeImage
                  src={artiste.coverUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="h-full w-full object-cover"
                />
              </span>
              <span>{artiste.stageName}</span>
              <button
                type="button"
                onClick={() => onChange(selection.filter((a) => a._id !== artiste._id))}
                aria-label={`Retirer ${artiste.stageName}`}
                className="grid h-5 w-5 place-items-center rounded-full text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un artiste..."
          className={`${CHAMP} pl-10`}
        />
      </div>

      {resultats.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border">
          {resultats.map((artiste) => (
            <li key={artiste._id}>
              <button
                type="button"
                onClick={() => ajouter(artiste)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-base"
              >
                <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-base">
                  <SafeImage
                    src={artiste.coverUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="truncate">{artiste.stageName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
