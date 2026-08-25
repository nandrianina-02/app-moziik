"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Loader2,
  Music2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formaterDuree, formaterOctets } from "@/lib/audioMetadata";
import { ImportCover } from "./ImportCover";
import { messageErreur, STATUT_META, type AlbumOption, type ArtisteOption, type LigneImport } from "./types";

function Champ({
  label,
  valeur,
  onChange,
  placeholder,
  type = "text",
  requis,
  invalide,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  requis?: boolean;
  invalide?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] text-ink-muted">
        {label} {requis && <span className="text-accent">*</span>}
      </span>
      <input
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-base px-2.5 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent ${
          invalide ? "border-danger" : "border-border"
        }`}
      />
    </label>
  );
}

function InfoLecture({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="truncate text-xs text-ink">{valeur}</p>
    </div>
  );
}

/**
 * Sélecteur d'artiste compact. Les balises ne portent qu'un NOM, alors que
 * le modèle exige une référence vers un profil Artist : cette étape de
 * rapprochement est obligatoire, elle ne peut pas être devinée.
 */
function ChampArtiste({
  ligne,
  onChange,
}: {
  ligne: LigneImport;
  onChange: (a: ArtisteOption | null) => void;
}) {
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<ArtisteOption[]>([]);
  const [recherche, setRecherche] = useState(false);

  async function chercher(valeur: string) {
    setRequete(valeur);
    if (valeur.trim().length < 2) {
      setResultats([]);
      return;
    }
    setRecherche(true);
    try {
      const res = await fetch(`/api/artists?search=${encodeURIComponent(valeur)}`);
      const data = res.ok ? await res.json() : { artists: [] };
      setResultats(data.artists ?? []);
    } catch {
      setResultats([]);
    } finally {
      setRecherche(false);
    }
  }

  if (ligne.artiste) {
    return (
      <div className="min-w-0">
        <span className="mb-1 block text-[11px] text-ink-muted">
          Artiste <span className="text-accent">*</span>
        </span>
        <div className="flex items-center justify-between gap-1.5 rounded-lg border border-border bg-base px-2.5 py-1.5">
          <span className="flex min-w-0 items-center gap-1 text-xs">
            <span className="truncate">{ligne.artiste.stageName}</span>
            {ligne.artiste.verified && <BadgeCheck size={11} className="shrink-0 text-verified" />}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Changer d'artiste"
            className="shrink-0 text-ink-muted transition-colors hover:text-accent"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] text-ink-muted">
        Artiste <span className="text-accent">*</span>
      </span>
      <div className="relative">
        <label className="flex items-center gap-1.5 rounded-lg border border-danger bg-base px-2.5 py-1.5 transition-colors focus-within:border-accent">
          <Search size={12} className="shrink-0 text-ink-muted" />
          <input
            value={requete}
            onChange={(e) => chercher(e.target.value)}
            placeholder={ligne.artisteNom ? `« ${ligne.artisteNom} » — à rapprocher` : "Rechercher l'artiste"}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-muted"
          />
        </label>
        {(resultats.length > 0 || recherche || requete.trim().length >= 2) && (
          <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
            {recherche && <p className="px-3 py-2 text-[11px] text-ink-muted">Recherche…</p>}
            {resultats.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => {
                  onChange(a);
                  setRequete("");
                  setResultats([]);
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs transition-colors hover:bg-base"
              >
                {a.stageName}
                {a.verified && <BadgeCheck size={10} className="text-verified" />}
              </button>
            ))}
            {!recherche && resultats.length === 0 && requete.trim().length >= 2 && (
              <p className="px-3 py-2 text-[11px] text-ink-muted">Aucun artiste trouvé.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportRow({
  ligne,
  genres,
  albums,
  enLecture,
  onLecture,
  onModifier,
  onArtiste,
  onPochette,
  onRetablirPochette,
  onSupprimer,
  onForcerDoublon,
}: {
  ligne: LigneImport;
  genres: string[];
  /** Albums de l'artiste rapproché — un morceau ne peut rejoindre qu'un album existant. */
  albums: AlbumOption[];
  enLecture: boolean;
  onLecture: () => void;
  onModifier: (champs: Partial<LigneImport>) => void;
  onArtiste: (a: ArtisteOption | null) => void;
  onPochette: (f: File) => void;
  onRetablirPochette: () => void;
  onSupprimer: () => void;
  onForcerDoublon: (valeur: boolean) => void;
}) {
  const meta = STATUT_META[ligne.statut];
  const enCours = ligne.statut === "analyse" || ligne.statut === "envoi";
  const termine = ligne.statut === "termine";
  const enErreur = ligne.statut === "erreur";
  // Le genre lu dans les balises n'appartient pas forcément à la liste du
  // site : on l'ajoute aux options plutôt que de l'écraser en silence.
  const optionsGenre = ligne.genre && !genres.includes(ligne.genre) ? [ligne.genre, ...genres] : genres;

  return (
    <div
      className={`rounded-xl2 border bg-surface p-4 transition-colors ${
        enErreur
          ? "border-danger/40"
          : ligne.statut === "doublon" || ligne.statut === "incomplet"
            ? "border-warning/40"
            : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <ImportCover
          ligne={ligne}
          enLecture={enLecture}
          onLecture={onLecture}
          onPochette={onPochette}
          onRetablirPochette={onRetablirPochette}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Music2 size={13} className="shrink-0 text-ink-muted" />
            <span className="min-w-0 max-w-full truncate text-sm font-medium" title={ligne.fichier.name}>
              {ligne.fichier.name}
            </span>
            {ligne.statut === "analyse" && (
              <span className="rounded-full bg-ink-muted/15 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                Analyse…
              </span>
            )}
            {ligne.meta && ligne.statut !== "analyse" && (
              <span className="rounded-full bg-verified/15 px-2 py-0.5 text-[10px] font-medium text-verified">
                {ligne.meta.nbPochettes > 0 ? "Métadonnées + pochette" : "Métadonnées détectées"}
              </span>
            )}
            {ligne.statut === "doublon" && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                {ligne.doublon?.certain ? "Doublon détecté" : "Homonyme détecté"}
              </span>
            )}
          </div>

          {enErreur && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2">
              <CircleAlert size={14} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-danger">{messageErreur(ligne)}</p>
                <p className="text-[11px] text-ink-muted">
                  Ce fichier ne peut pas être importé : la durée est indispensable à la fiche du morceau.
                </p>
              </div>
            </div>
          )}

          {ligne.statut === "incomplet" && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
              <p className="text-xs text-warning">
                {!ligne.titre.trim()
                  ? "Titre manquant."
                  : !ligne.artiste
                    ? "Aucun profil artiste ne correspond à la balise : rapprochez-le ci-dessous."
                    : "Genre manquant."}
              </p>
            </div>
          )}

          {ligne.statut === "doublon" && ligne.doublon && (
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
              <div className="flex min-w-0 items-start gap-2">
                <Copy size={14} className="mt-0.5 shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-warning">
                    « {ligne.doublon.title} » existe déjà chez {ligne.doublon.artistName}.
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {ligne.doublon.certain
                      ? "Même titre et même artiste au catalogue."
                      : "Même titre, artiste différent — à vous de trancher."}
                  </p>
                </div>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={ligne.importerMalgreDoublon}
                  onChange={(e) => onForcerDoublon(e.target.checked)}
                  className="h-3.5 w-3.5 accent-accent"
                />
                Importer quand même
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Champ
              label="Titre"
              requis
              valeur={ligne.titre}
              onChange={(titre) => onModifier({ titre })}
              placeholder="Titre du morceau"
              invalide={!ligne.titre.trim()}
            />
            <ChampArtiste ligne={ligne} onChange={onArtiste} />

            {/* Un album se référence par identifiant, pas par nom : la
                balise ne sert qu'à présélectionner un album existant de
                l'artiste. Aucun album n'est créé par l'import. */}
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-ink-muted">Album</span>
              <select
                value={ligne.albumId}
                onChange={(e) => onModifier({ albumId: e.target.value })}
                disabled={!ligne.artiste}
                className="w-full rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-accent disabled:opacity-60"
              >
                <option value="">Single</option>
                {albums.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.title}
                  </option>
                ))}
              </select>
              {ligne.album && !ligne.albumId && (
                <span className="mt-1 block truncate text-[11px] text-ink-muted" title={ligne.album}>
                  Balise : « {ligne.album} » — aucun album correspondant
                </span>
              )}
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-ink-muted">
                Genre <span className="text-accent">*</span>
              </span>
              <select
                value={ligne.genre}
                onChange={(e) => onModifier({ genre: e.target.value })}
                className="w-full rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-accent"
              >
                {optionsGenre.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <Champ label="Année" type="number" valeur={ligne.annee} onChange={(annee) => onModifier({ annee })} placeholder="2026" />
            <Champ label="Piste" type="number" valeur={ligne.piste} onChange={(piste) => onModifier({ piste })} placeholder="1" />
            <div className="sm:col-span-2 lg:col-span-3">
              <Champ
                label="Compositeur"
                valeur={ligne.compositeur}
                onChange={(compositeur) => onModifier({ compositeur })}
                placeholder="Nom du compositeur"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
            <InfoLecture label="Durée" valeur={formaterDuree(ligne.meta?.duree)} />
            <InfoLecture label="Format" valeur={ligne.meta?.format ?? ligne.fichier.name.split(".").pop()?.toUpperCase() ?? "—"} />
            <InfoLecture label="Débit" valeur={ligne.meta?.debit ? `${Math.round(ligne.meta.debit / 1000)} kbps` : "—"} />
            <InfoLecture label="Taille" valeur={formaterOctets(ligne.fichier.size)} />
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-start justify-between gap-3 lg:w-[150px] lg:flex-col lg:justify-start">
          <div>
            <p className={`flex items-center gap-1.5 text-sm font-medium ${meta.couleur}`}>
              {enCours ? (
                <Loader2 size={14} className="animate-spin" />
              ) : termine ? (
                <CircleCheck size={14} />
              ) : enErreur ? (
                <CircleAlert size={14} />
              ) : ligne.statut === "doublon" || ligne.statut === "incomplet" ? (
                <AlertTriangle size={14} />
              ) : (
                <Check size={14} />
              )}
              {meta.libelle}
            </p>
            <p className="text-[11px] text-ink-muted">{meta.detail}</p>

            {ligne.statut === "envoi" && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border lg:w-[120px]">
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${ligne.progression}%` }} />
              </div>
            )}
          </div>

          {!termine && (
            <button
              type="button"
              onClick={onSupprimer}
              aria-label="Retirer ce fichier"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-danger hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
