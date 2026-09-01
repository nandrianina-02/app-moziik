"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { SkeletonForm } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastProvider";
import { useSiteConfig } from "@/context/SiteConfigProvider";
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

function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold">{titre}</h2>
      {children}
    </section>
  );
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const pushToast = useToast();
  const { currency } = useSiteConfig();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- L'essentiel ------------------------------------------------------
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [price, setPrice] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // ---- La fiche détaillée ----------------------------------------------
  const [gallery, setGallery] = useState<string[]>([]);
  const [lineup, setLineup] = useState<ArtisteAffiche[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [program, setProgram] = useState<MomentProgramme[]>([]);
  const [practicalInfo, setPracticalInfo] = useState<string[]>([]);
  const [tickets, setTickets] = useState<CategorieBillet[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const e: EventDetail = data.event;
        setEvent(e);

        setTitle(e.title);
        setDescription(e.description);
        setCategory(e.category ?? "");
        setLocation(e.location);
        setAddress(e.address ?? "");
        setDate(pourChampLocal(e.date));
        setEndDate(e.endDate ? pourChampLocal(e.endDate) : "");
        setTicketUrl(e.ticketUrl ?? "");
        setPrice(e.price?.toString() ?? "");
        setLatitude(e.latitude?.toString() ?? "");
        setLongitude(e.longitude?.toString() ?? "");

        setGallery(e.gallery ?? []);
        setLineup(e.lineup ?? []);
        setHighlights(e.highlights ?? []);
        setInclusions(e.inclusions ?? []);
        setProgram(e.program ?? []);
        setPracticalInfo(e.practicalInfo ?? []);
        setTickets(e.tickets ?? []);
      } catch {
        pushToast("error", "Impossible de charger cet évènement.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, pushToast]);

  const canManage =
    session?.user?.role === "admin" || (event && session?.user?.id === event.createdBy);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Une seule des deux coordonnées ne situe rien : la carte serait posée
    // sur l'équateur ou sur le méridien de Greenwich.
    if (Boolean(latitude) !== Boolean(longitude)) {
      pushToast("error", "Renseigne la latitude et la longitude, ou aucune des deux.");
      return;
    }
    if (endDate && new Date(endDate) <= new Date(date)) {
      pushToast("error", "L'heure de fin doit suivre l'heure de début.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          date: new Date(date).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          category: category || undefined,
          address: address || undefined,
          ticketUrl: ticketUrl || undefined,
          price: price ? Number(price) : undefined,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          gallery,
          lineup: lineup.map((a) => a._id),
          highlights,
          inclusions,
          // Les lignes laissées vides par inadvertance ne partent pas :
          // le schéma les refuserait et l'enregistrement entier échouerait.
          program: program.filter((m) => m.time.trim() && m.title.trim()),
          practicalInfo,
          tickets: tickets.filter((b) => b.name.trim()),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "La mise à jour a échoué."));
      pushToast("success", "Évènement mis à jour.");
      router.push(`/evenements/${id}`);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "La mise à jour a échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) return <SkeletonForm fields={6} />;

  if (!event) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Cet évènement est introuvable.</p>;
  }

  if (!canManage) {
    return <p className="px-6 py-10 text-sm text-ink-muted">Tu n&apos;as pas accès à cette page.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 md:px-10 md:py-10">
      <Link
        href={`/evenements/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Retour à la fiche
      </Link>

      <h1 className="mb-1 font-display text-2xl">Modifier l&apos;évènement</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Tout ce qui suit l&apos;essentiel est facultatif : une rubrique laissée vide n&apos;apparaît
        pas sur la fiche.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Rubrique titre="L'essentiel">
          <FormField label="Titre" required value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">Description</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-ink-muted">Catégorie</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Non précisée</option>
              {EVENT_CATEGORIES.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {libelleCategorie(valeur)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Début"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <FormField
              label="Fin (optionnel)"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </Rubrique>

        <Rubrique titre="Lieu">
          <FormField label="Nom du lieu" required value={location} onChange={(e) => setLocation(e.target.value)} />
          <FormField
            label="Adresse (optionnel)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
            Les deux ensemble affichent une carte sur la fiche. Sans elles, le lien
            « Itinéraire » cherche simplement le nom du lieu.
          </p>
        </Rubrique>

        <Rubrique titre="Billetterie">
          <FormField
            label="Lien billetterie (optionnel)"
            value={ticketUrl}
            onChange={(e) => setTicketUrl(e.target.value)}
          />
          <FormField
            label={`Prix d'entrée (optionnel, en ${currency ?? "EUR"})`}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <ChampsBillets billets={tickets} onChange={setTickets} devise={currency ?? "EUR"} />
        </Rubrique>

        <Rubrique titre="La fiche">
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
            aide="Âge minimum, accès, objets interdits..."
            placeholder="Interdit aux moins de 18 ans"
            valeurs={practicalInfo}
            onChange={setPracticalInfo}
          />
        </Rubrique>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
