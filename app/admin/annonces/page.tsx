"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, List, Megaphone, Send, Users, Mic2, Crown, Bell } from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { FormField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TexteAnnonce } from "@/components/notifications/TexteAnnonce";
import { useToast } from "@/context/ToastProvider";
import { texteBrut } from "@/lib/annonceTexte";

type PublicAnnonce = "tous" | "artistes" | "premium";
type Annonce = {
  _id: string;
  titre: string;
  message: string;
  lien?: string;
  public: PublicAnnonce;
  destinataires: number;
  auteur?: { name?: string } | null;
  createdAt: string;
};

const PUBLICS: { valeur: PublicAnnonce; libelle: string; detail: string; icone: typeof Users }[] = [
  { valeur: "tous", libelle: "Tous les membres", detail: "Chaque compte actif", icone: Users },
  { valeur: "artistes", libelle: "Artistes", detail: "Les comptes artistes", icone: Mic2 },
  { valeur: "premium", libelle: "Abonnés Premium", detail: "Abonnement en cours", icone: Crown },
];

const MAX_MESSAGE = 4000;

/**
 * Annonces de la plateforme : un message mis en forme, envoyé en
 * notification « Annonce » (cloche du site, app) et en push sur les
 * téléphones, à tous les membres, aux artistes ou aux abonnés Premium.
 */
export default function AdminAnnoncesPage() {
  const pushToast = useToast();
  const zone = useRef<HTMLTextAreaElement>(null);
  const [annonces, setAnnonces] = useState<Annonce[] | null>(null);
  const [publics, setPublics] = useState<Record<PublicAnnonce, number> | null>(null);
  const [cible, setCible] = useState<PublicAnnonce>("tous");
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [lien, setLien] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function charger() {
    try {
      const res = await fetch("/api/admin/annonces");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnnonces(data.annonces);
      setPublics(data.publics);
    } catch {
      pushToast("error", "Impossible de charger les annonces.");
      setAnnonces([]);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Entoure la sélection (ou insère un modèle) : la mise en forme s'écrit dans le texte, visible et corrigeable. */
  function entourer(avant: string, apres: string, modele: string) {
    const z = zone.current;
    if (!z) return;
    const debut = z.selectionStart;
    const fin = z.selectionEnd;
    const choisi = message.slice(debut, fin) || modele;
    const nouveau = message.slice(0, debut) + avant + choisi + apres + message.slice(fin);
    setMessage(nouveau.slice(0, MAX_MESSAGE));
    requestAnimationFrame(() => {
      z.focus();
      z.setSelectionRange(debut + avant.length, debut + avant.length + choisi.length);
    });
  }

  function lienInsere() {
    const adresse = window.prompt("Adresse du lien (une page du site, ex. /evenements, ou https://…)");
    if (!adresse) return;
    entourer("[", `](${adresse.trim()})`, "texte du lien");
  }

  function liste() {
    const z = zone.current;
    if (!z) return;
    const debut = message.lastIndexOf("\n", z.selectionStart - 1) + 1;
    const fin = message.indexOf("\n", z.selectionEnd);
    const bout = message.slice(debut, fin === -1 ? undefined : fin);
    const enListe = bout.split("\n").map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
    setMessage((message.slice(0, debut) + enListe + (fin === -1 ? "" : message.slice(fin))).slice(0, MAX_MESSAGE));
  }

  async function envoyer() {
    setEnvoi(true);
    try {
      const res = await fetch("/api/admin/annonces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre, message, lien: lien.trim() || undefined, public: cible }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "L'envoi a échoué.");
      pushToast("success", `Annonce envoyée à ${data.annonce.destinataires} personne${data.annonce.destinataires > 1 ? "s" : ""}.`);
      setTitre("");
      setMessage("");
      setLien("");
      charger();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "L'envoi a échoué.");
    } finally {
      setEnvoi(false);
      setConfirmation(false);
    }
  }

  const pret = titre.trim().length > 0 && message.trim().length > 0;
  const outils = [
    { icone: Bold, libelle: "Gras", action: () => entourer("**", "**", "texte en gras") },
    { icone: Italic, libelle: "Italique", action: () => entourer("*", "*", "texte en italique") },
    { icone: Link2, libelle: "Lien", action: lienInsere },
    { icone: List, libelle: "Liste", action: liste },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5 animate-fade-in-up">
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-ink-muted">Destinataires</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {PUBLICS.map(({ valeur, libelle, detail, icone: Icone }) => {
              const actif = cible === valeur;
              return (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setCible(valeur)}
                  aria-pressed={actif}
                  className={`flex items-start gap-3 rounded-xl2 border p-3 text-left transition-colors ${
                    actif ? "border-accent bg-accent/[0.08]" : "border-border bg-surface hover:border-accent"
                  }`}
                >
                  <Icone size={18} className={actif ? "text-accent" : "text-ink-muted"} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{libelle}</span>
                    <span className="block text-xs text-ink-muted">
                      {publics ? `${publics[valeur]} compte${publics[valeur] > 1 ? "s" : ""}` : detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <FormField label="Titre" required maxLength={120} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Nouvelle fonction : écoute hors connexion" />

        <div>
          <span className="mb-1.5 block text-sm text-ink-muted">Message</span>
          <div className="overflow-hidden rounded-xl2 border border-border bg-surface focus-within:border-accent">
            <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
              {outils.map(({ icone: Icone, libelle, action }) => (
                <button
                  key={libelle}
                  type="button"
                  onClick={action}
                  title={libelle}
                  aria-label={libelle}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-base hover:text-ink"
                >
                  <Icone size={16} />
                </button>
              ))}
              <span className="ml-auto pr-1 text-[11px] text-ink-muted">
                {message.length} / {MAX_MESSAGE}
              </span>
            </div>
            <textarea
              ref={zone}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              rows={9}
              placeholder={"Bonjour à tous,\n\n**Nouveau** sur Moziik : …\n\n- premier point\n- second point"}
              className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted/60"
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            **gras**, *italique*, [texte](lien), une ligne vide entre deux paragraphes, « - » en début de ligne pour une liste.
          </p>
        </div>

        <FormField
          label="Lien à ouvrir en touchant l'annonce (facultatif)"
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          placeholder="/evenements, /album/…, ou https://…"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!pret || envoi}
            onClick={() => setConfirmation(true)}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-base transition-opacity disabled:opacity-40"
          >
            <Send size={15} /> Envoyer l&apos;annonce
          </button>
          <span className="text-xs text-ink-muted">Cloche du site et de l&apos;app, et notification sur les téléphones.</span>
        </div>
      </section>

      <aside className="space-y-6 animate-fade-in-up">
        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-ink-muted">Aperçu</h2>
          <div className="rounded-xl2 border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/[0.12] text-accent">
                <Megaphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{titre || "Titre de l'annonce"}</p>
                {message.trim() ? (
                  <TexteAnnonce texte={message} className="mt-1 text-sm text-ink-muted" />
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">Le message mis en forme s&apos;affiche ici.</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-base p-3">
              <Bell size={14} className="mt-0.5 shrink-0 text-ink-muted" />
              <p className="min-w-0 text-xs text-ink-muted">
                <span className="font-medium text-ink">Notification sur le téléphone :</span>{" "}
                <span className="line-clamp-3">{message.trim() ? texteBrut(message) : "le texte, sans la mise en forme."}</span>
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-ink-muted">Déjà envoyées</h2>
          {annonces === null ? (
            <AdminCardsSkeleton count={3} cols={1} />
          ) : annonces.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune annonce pour le moment.</p>
          ) : (
            <ul className="stagger divide-y divide-border rounded-xl2 border border-border bg-surface">
              {annonces.map((a) => (
                <li key={a._id} className="p-3">
                  <p className="text-sm font-medium text-ink">{a.titre}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{texteBrut(a.message)}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {new Date(a.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {PUBLICS.find((p) => p.valeur === a.public)?.libelle} · {a.destinataires} destinataire{a.destinataires > 1 ? "s" : ""}
                    {a.auteur?.name ? ` · ${a.auteur.name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {confirmation && (
        <ConfirmDialog
          title="Envoyer cette annonce ?"
          description={`Elle partira à ${publics?.[cible] ?? "tous les"} ${PUBLICS.find((p) => p.valeur === cible)?.libelle.toLowerCase()}, sur le site, dans l'app et en notification sur les téléphones. Elle ne peut pas être retirée ensuite.`}
          confirmLabel="Envoyer"
          danger={false}
          busy={envoi}
          onConfirm={envoyer}
          onCancel={() => setConfirmation(false)}
        />
      )}
    </div>
  );
}
