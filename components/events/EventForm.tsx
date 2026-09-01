"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronRight, ImagePlus, Info } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Switch } from "@/components/ui/Switch";
import { TagInput } from "@/components/ui/TagInput";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { readApiError } from "@/lib/readApiError";
import { EVENT_CATEGORIES, libelleCategorie } from "@/lib/evenements";
import {
  ChampsBillets,
  ChampsGalerie,
  ChampsListe,
  ChampsProgramme,
  SelecteurArtistes,
} from "@/components/events/EventFicheFields";
import type {
  ArtisteAffiche,
  CategorieBillet,
  EventDetail,
  MomentProgramme,
} from "@/components/events/detail/types";

/**
 * Le formulaire d'un évènement, pour la création comme pour la
 * modification.
 *
 * Un seul composant pour les deux : les champs sont nombreux, et deux
 * copies auraient divergé au premier ajout. Ce qui change entre les deux
 * tient dans `mode` — la méthode HTTP, l'intitulé du bouton, et le fait
 * qu'une création n'a pas encore d'adresse où revenir.
 */

const CHAMP =
  "w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent";

const MAX_DESCRIPTION = 2000;

/**
 * Valeur pour un champ `datetime-local`, qui raisonne en heure locale.
 *
 * `toISOString().slice(0, 16)` donnait l'heure UTC dans un champ que le
 * navigateur relit comme une heure locale : rouvrir puis réenregistrer une
 * fiche décalait la date du fuseau du navigateur, à chaque passage.
 */
function pourChampLocal(valeur: string | Date): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Le jour d'une valeur `datetime-local`, pour comparer deux dates sans leur heure. */
function jourDe(valeur: string): string {
  return valeur.slice(0, 10);
}

function Bloc({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl2 border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{titre}</h2>
      {aide && <p className="mt-1 text-xs text-ink-muted">{aide}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Libelle({ children, requis }: { children: React.ReactNode; requis?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm text-ink-muted">
      {children}
      {requis && <span className="ml-0.5 text-accent">*</span>}
    </span>
  );
}

export function EventForm({
  mode,
  initial,
  peutChoisirStatut,
}: {
  mode: "create" | "edit";
  /** Absent en création. */
  initial?: EventDetail;
  /** Un admin seul peut publier ou dépublier directement. */
  peutChoisirStatut: boolean;
}) {
  const router = useRouter();
  const pushToast = useToast();
  const { currency } = useSiteConfig();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [envoiAffiche, setEnvoiAffiche] = useState(false);

  const [date, setDate] = useState(initial ? pourChampLocal(initial.date) : "");
  const [endDate, setEndDate] = useState(initial?.endDate ? pourChampLocal(initial.endDate) : "");
  // Ouvert d'emblée quand la fiche existante s'étale sur deux jours : le
  // repli refermerait un champ déjà renseigné.
  const [plusieursJours, setPlusieursJours] = useState(
    Boolean(initial?.endDate && jourDe(pourChampLocal(initial.endDate)) !== jourDe(pourChampLocal(initial.date)))
  );

  const [location, setLocation] = useState(initial?.location ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [mapsUrl, setMapsUrl] = useState(initial?.mapsUrl ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() ?? "");

  const [ticketUrl, setTicketUrl] = useState(initial?.ticketUrl ?? "");
  const [price, setPrice] = useState(initial?.price?.toString() ?? "");
  const [tickets, setTickets] = useState<CategorieBillet[]>(initial?.tickets ?? []);

  const [gallery, setGallery] = useState<string[]>(initial?.gallery ?? []);
  const [lineup, setLineup] = useState<ArtisteAffiche[]>(initial?.lineup ?? []);
  const [highlights, setHighlights] = useState<string[]>(initial?.highlights ?? []);
  const [inclusions, setInclusions] = useState<string[]>(initial?.inclusions ?? []);
  const [program, setProgram] = useState<MomentProgramme[]>(initial?.program ?? []);
  const [practicalInfo, setPracticalInfo] = useState<string[]>(initial?.practicalInfo ?? []);

  const [organizerName, setOrganizerName] = useState(initial?.organizer?.name ?? "");
  const [organizerEmail, setOrganizerEmail] = useState(initial?.organizer?.email ?? "");
  const [organizerPhone, setOrganizerPhone] = useState(initial?.organizer?.phone ?? "");
  const [organizerWebsite, setOrganizerWebsite] = useState(initial?.organizer?.website ?? "");

  const [visibility, setVisibility] = useState(initial?.visibility ?? "public");
  const [statut, setStatut] = useState(initial?.status ?? "published");
  const [minAge, setMinAge] = useState(initial?.minAge?.toString() ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  const [enregistrement, setEnregistrement] = useState(false);

  async function envoyerAffiche(fichier: File | null) {
    if (!fichier) return;
    setEnvoiAffiche(true);
    try {
      const envoi = await uploadToCloudinaryClient(fichier, "covers");
      setCoverUrl(envoi.url);
    } catch {
      pushToast("error", "L'envoi de l'affiche a échoué.");
    } finally {
      setEnvoiAffiche(false);
    }
  }

  function corpsDeLaRequete() {
    // La fin n'est envoyée que si elle a un sens : le champ reste rempli
    // quand on referme « plusieurs jours », mais ce qui compte est ce que
    // l'utilisateur voit au moment d'enregistrer.
    const finRetenue = plusieursJours || (endDate && jourDe(endDate) === jourDe(date)) ? endDate : "";

    return {
      title,
      description,
      location,
      date: new Date(date).toISOString(),
      endDate: finRetenue ? new Date(finRetenue).toISOString() : undefined,
      category: category || undefined,
      coverUrl: coverUrl || undefined,
      address: address || undefined,
      postalCode: postalCode || undefined,
      city: city || undefined,
      country: country || undefined,
      mapsUrl: mapsUrl || undefined,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      ticketUrl: ticketUrl || undefined,
      price: price ? Number(price) : undefined,
      tickets: tickets.filter((b) => b.name.trim()),
      gallery,
      lineup: lineup.map((a) => a._id),
      highlights,
      inclusions,
      // Les lignes laissées vides par inadvertance ne partent pas : le
      // schéma les refuserait et l'enregistrement entier échouerait.
      program: program.filter((m) => m.time.trim() && m.title.trim()),
      practicalInfo,
      tags,
      minAge: minAge ? Number(minAge) : undefined,
      visibility,
      organizer:
        organizerName || organizerEmail || organizerPhone || organizerWebsite
          ? {
              name: organizerName || undefined,
              email: organizerEmail || undefined,
              phone: organizerPhone || undefined,
              website: organizerWebsite || undefined,
            }
          : undefined,
      ...(peutChoisirStatut && mode === "edit" ? { status: statut } : {}),
    };
  }

  function valide(): string | null {
    if (Boolean(latitude) !== Boolean(longitude)) {
      // Une seule des deux coordonnées ne situe rien : la carte se poserait
      // sur l'équateur ou sur le méridien de Greenwich.
      return "Renseigne la latitude et la longitude, ou aucune des deux.";
    }
    const fin = plusieursJours ? endDate : endDate && jourDe(endDate) === jourDe(date) ? endDate : "";
    if (fin && new Date(fin) <= new Date(date)) {
      return "L'heure de fin doit suivre l'heure de début.";
    }
    return null;
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();

    const probleme = valide();
    if (probleme) {
      pushToast("error", probleme);
      return;
    }

    setEnregistrement(true);
    try {
      const res = await fetch(mode === "create" ? "/api/events" : `/api/events/${initial?._id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpsDeLaRequete()),
      });
      if (!res.ok) throw new Error(await readApiError(res, "L'enregistrement a échoué."));
      const data = await res.json();

      if (mode === "create") {
        pushToast(
          "success",
          data.event.status === "published"
            ? "Évènement publié."
            : "Évènement envoyé pour validation."
        );
        router.push(`/evenements/${data.event._id}`);
      } else {
        pushToast("success", "Évènement mis à jour.");
        router.push(`/evenements/${initial?._id}`);
      }
      router.refresh();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  }

  const retour = mode === "edit" && initial ? `/evenements/${initial._id}` : "/evenements";

  return (
    <form onSubmit={soumettre} className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
      <nav aria-label="Fil d'Ariane" className="mb-3 flex items-center gap-1 text-xs text-ink-muted">
        <Link href="/evenements" className="transition-colors hover:text-ink">
          Évènements
        </Link>
        <ChevronRight size={12} />
        <span className="text-ink">{mode === "create" ? "Ajouter un évènement" : "Modifier"}</span>
      </nav>

      <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-3xl">
            {mode === "create" ? "Ajouter un évènement" : "Modifier l'évènement"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === "create"
              ? "Créez un nouvel évènement et partagez-le avec votre communauté."
              : "Tout ce qui suit l'essentiel est facultatif : une rubrique vide n'apparaît pas sur la fiche."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href={retour}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={enregistrement}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {enregistrement
              ? "Enregistrement..."
              : mode === "create"
              ? "Enregistrer l'évènement"
              : "Enregistrer"}
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Bloc titre="Informations générales">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Titre de l'évènement"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />

              <label className="block">
                <Libelle requis>Catégorie</Libelle>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={CHAMP}>
                  <option value="">Sélectionner une catégorie</option>
                  {EVENT_CATEGORIES.map((valeur) => (
                    <option key={valeur} value={valeur}>
                      {libelleCategorie(valeur)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <Libelle requis>Description</Libelle>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                rows={6}
                placeholder="Décrivez l'évènement, le concept, les activités..."
                className={`${CHAMP} resize-none`}
              />
              <span className="mt-1 block text-right text-xs text-ink-muted">
                {description.length}/{MAX_DESCRIPTION}
              </span>
            </label>
          </Bloc>

          <Bloc titre="Date et heure">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Début"
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {plusieursJours ? (
                <FormField
                  label="Fin"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              ) : (
                <FormField
                  label="Heure de fin (optionnel)"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={plusieursJours} onChange={setPlusieursJours} label="Évènement sur plusieurs jours" />
              <span className="text-sm text-ink-muted">Évènement sur plusieurs jours</span>
            </div>
          </Bloc>

          <Bloc titre="Lieu">
            <FormField
              label="Lieu / salle"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <FormField label="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              <FormField label="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
              <FormField label="Pays" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>

            <FormField
              label="Lien de carte (optionnel)"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Latitude (optionnel)"
                type="number"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <FormField
                label="Longitude (optionnel)"
                type="number"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
            <p className="text-xs text-ink-muted">
              Les coordonnées affichent une carte sur la fiche ; le lien, lui, remplace seulement
              la destination des boutons « Voir sur la carte » et « Itinéraire ».
            </p>
          </Bloc>

          <Bloc titre="Affiche">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center transition-colors hover:border-accent">
              <ImagePlus size={22} className="text-ink-muted" />
              <span className="text-sm font-medium">
                {envoiAffiche ? "Envoi en cours..." : coverUrl ? "Remplacer l'affiche" : "Choisir une affiche"}
              </span>
              <span className="text-xs text-ink-muted">Format conseillé : 16/9 — JPG ou PNG</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={envoiAffiche}
                onChange={(e) => {
                  envoyerAffiche(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          </Bloc>

          <Bloc titre="Billetterie" aide={`Prix en ${currency ?? "EUR"}. L'achat se fait chez l'organisateur.`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Lien billetterie (optionnel)"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
              />
              <FormField
                label="Prix d'entrée (optionnel)"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {/* Les catégories de billets attendent la modification : à la
                création, l'urgence est d'annoncer la date, pas de détailler
                une grille tarifaire souvent pas encore arrêtée. */}
            {mode === "edit" && (
              <ChampsBillets billets={tickets} onChange={setTickets} devise={currency ?? "EUR"} />
            )}
          </Bloc>

          {mode === "edit" && (
          <Bloc titre="La fiche" aide="Chaque rubrique laissée vide disparaît simplement de la page publique.">
            <ChampsGalerie urls={gallery} onChange={setGallery} />
            <SelecteurArtistes selection={lineup} onChange={setLineup} />
            <ChampsListe
              label="Points saillants"
              aide="Affichés en pastilles sous la description."
              placeholder="2 scènes"
              valeurs={highlights}
              onChange={setHighlights}
              max={8}
            />
            <ChampsListe
              label="Ce qui vous attend"
              aide="Une liste à puces sous la description."
              placeholder="Scène principale avec les têtes d'affiche"
              valeurs={inclusions}
              onChange={setInclusions}
            />
            <ChampsProgramme moments={program} onChange={setProgram} />
            <ChampsListe
              label="Infos pratiques"
              aide="Accès, objets interdits, vestiaire..."
              placeholder="Vestiaire payant à l'entrée"
              valeurs={practicalInfo}
              onChange={setPracticalInfo}
            />
          </Bloc>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <Bloc titre="Aperçu de l'affiche">
            {coverUrl ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <SafeImage
                  src={coverUrl}
                  alt="Aperçu de l'affiche"
                  width={340}
                  height={212}
                  className="aspect-[16/10] w-full object-cover"
                />
              </div>
            ) : (
              <div className="grid aspect-[16/10] w-full place-items-center rounded-xl border border-dashed border-border text-xs text-ink-muted">
                Aucune affiche sélectionnée
              </div>
            )}
          </Bloc>

          <Bloc
            titre="Organisateur"
            aide="Laissé vide, la fiche affiche l'artiste rattaché, ou la plateforme à défaut."
          >
            <FormField
              label="Nom de l'organisateur"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
            />
            <FormField
              label="Email de contact"
              type="email"
              value={organizerEmail}
              onChange={(e) => setOrganizerEmail(e.target.value)}
            />
            <FormField label="Téléphone" value={organizerPhone} onChange={(e) => setOrganizerPhone(e.target.value)} />
            <FormField
              label="Site web"
              value={organizerWebsite}
              onChange={(e) => setOrganizerWebsite(e.target.value)}
            />
          </Bloc>

          <Bloc titre="Paramètres">
            {peutChoisirStatut && mode === "edit" && (
              <label className="block">
                <Libelle>Statut</Libelle>
                <select
                  value={statut}
                  onChange={(e) => setStatut(e.target.value as EventDetail["status"])}
                  className={CHAMP}
                >
                  <option value="published">Publié</option>
                  <option value="pending">En attente de validation</option>
                  <option value="rejected">Rejeté</option>
                </select>
              </label>
            )}

            <label className="block">
              <Libelle>Visibilité</Libelle>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "unlisted")}
                className={CHAMP}
              >
                <option value="public">Public</option>
                <option value="unlisted">Non répertorié</option>
              </select>
              <span className="mt-1 block text-xs text-ink-muted">
                {visibility === "public"
                  ? "Visible de tous, dans les listes et la recherche."
                  : "Accessible par son lien seulement : ni liste, ni recherche, ni moteurs."}
              </span>
            </label>

            <FormField
              label="Âge minimum (optionnel)"
              type="number"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
            />
          </Bloc>

          <Bloc titre="Tags">
            <TagInput value={tags} onChange={setTags} placeholder="Ajouter un tag et valider" maxTags={15} />
          </Bloc>

          {mode === "create" && (
            <p className="flex items-start gap-2.5 rounded-xl2 border border-border bg-accent/5 p-4 text-xs text-ink-muted">
              <CalendarCheck size={15} className="mt-0.5 shrink-0 text-accent" />
              Une fois l&apos;évènement enregistré, sa fiche s&apos;ouvre : le déroulé, les
              catégories de billets, la galerie et les artistes à l&apos;affiche s&apos;y
              ajoutent depuis « Modifier ».
            </p>
          )}

          {mode === "edit" && initial?.status === "pending" && (
            <p className="flex items-start gap-2.5 rounded-xl2 border border-warning/30 bg-warning/10 p-4 text-xs text-warning">
              <Info size={15} className="mt-0.5 shrink-0" />
              En attente de validation : la fiche n&apos;est visible que de toi.
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}
