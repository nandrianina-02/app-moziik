import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { api } from "../api";
import { Carte, Chargement, EnTete, Erreur, formatNombre } from "../composants";
import type { Page } from "../App";
import { adresseSite } from "../api";

interface Stats {
  members: number;
  artists: number;
  publishedSongs: number;
  pendingSongs: number;
  pendingEvents: number;
  activeSubscriptions: number;
  albumsCount: number;
  playlistsCount: number;
  trends?: { members?: number; artists?: number; songs?: number };
}

/** Ce qui attend l'administration, par page du site. */
type ATraiter = Record<string, number>;

type Etat = "inconnu" | "ok" | "lent" | "panne";

/**
 * Le tableau de bord : les chiffres du catalogue, ce qui attend une
 * décision, et l'état des services dont Moziik dépend. Les chiffres
 * viennent de l'API d'administration ; l'état des services se mesure
 * d'ici, en appelant chacun.
 */
export function TableauDeBord({ aller }: { aller: (p: Page) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [aTraiter, setATraiter] = useState<ATraiter | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [services, setServices] = useState<{ nom: string; etat: Etat; detail: string }[]>([]);

  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setStats).catch((e) => setErreur(e.message));
    api<ATraiter>("/api/admin/a-traiter").then(setATraiter).catch(() => setATraiter({}));
    void mesurerServices().then(setServices);
  }, []);

  const tendance = (v?: number) => (typeof v === "number" && v !== 0 ? `${v > 0 ? "+" : ""}${v} % sur 30 j` : undefined);
  const enAttente = (aTraiter?.["/admin/doublons"] ?? 0) + (aTraiter?.["/admin/annees"] ?? 0) + (aTraiter?.["/admin/genres"] ?? 0);

  return (
    <>
      <EnTete titre="Tableau de bord" texte="L'état de Moziik en un coup d'œil." />
      <Erreur message={erreur} />
      {!stats ? (
        <Chargement />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          <Chiffre libelle="Membres" valeur={stats.members} sous={tendance(stats.trends?.members)} />
          <Chiffre libelle="Artistes" valeur={stats.artists} sous={tendance(stats.trends?.artists)} />
          <Chiffre libelle="Titres publiés" valeur={stats.publishedSongs} sous={tendance(stats.trends?.songs)} />
          <Chiffre libelle="Abonnements actifs" valeur={stats.activeSubscriptions} />

          <Carte titre="À traiter" className="lg:col-span-2">
            <ul className="divide-y divide-filet text-[13px]">
              <Ligne libelle="Titres en attente de validation" valeur={stats.pendingSongs} action={() => aller("catalogue")} />
              <Ligne libelle="Évènements en attente" valeur={stats.pendingEvents} action={() => aller("moderation")} />
              <Ligne libelle="Commentaires signalés" valeur={aTraiter?.["/admin/messages"] ?? 0} action={() => aller("moderation")} />
              <Ligne libelle="Doublons, années et genres à vérifier" valeur={enAttente} action={() => void window.bureau.ouvrirExterne(`${adresseSite()}/admin/doublons`)} />
            </ul>
          </Carte>

          <Carte titre="Services" className="lg:col-span-2">
            <ul className="divide-y divide-filet text-[13px]">
              {services.length === 0 ? (
                <li className="flex items-center gap-2 py-2 text-texte-3">
                  <Loader2 size={14} className="animate-spin" /> Mesure en cours…
                </li>
              ) : (
                services.map((s) => (
                  <li key={s.nom} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2">
                      {s.etat === "ok" ? <CheckCircle2 size={15} className="text-succes" /> : <CircleAlert size={15} className={s.etat === "lent" ? "text-attention" : "text-danger"} />}
                      {s.nom}
                    </span>
                    <span className="text-texte-2">{s.detail}</span>
                  </li>
                ))
              )}
            </ul>
          </Carte>

          <Carte titre="Catalogue" className="lg:col-span-4">
            <div className="grid grid-cols-3 gap-4 text-[13px]">
              <div>
                <div className="text-texte-3">Albums et singles</div>
                <div className="text-[18px] font-semibold tabular-nums">{formatNombre(stats.albumsCount)}</div>
              </div>
              <div>
                <div className="text-texte-3">Playlists</div>
                <div className="text-[18px] font-semibold tabular-nums">{formatNombre(stats.playlistsCount)}</div>
              </div>
              <div className="flex items-end">
                <button onClick={() => aller("import")} className="inline-flex items-center gap-1 text-accent hover:underline">
                  Importer de la musique <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </Carte>
        </div>
      )}
    </>
  );
}

function Chiffre({ libelle, valeur, sous }: { libelle: string; valeur: number; sous?: string }) {
  return (
    <div className="animate-monter rounded-lg border border-filet bg-surface px-4 py-3">
      <div className="text-[12px] text-texte-3">{libelle}</div>
      <div className="mt-0.5 text-[24px] font-semibold tracking-tight tabular-nums">{formatNombre(valeur)}</div>
      {sous && <div className="text-[12px] text-texte-2">{sous}</div>}
    </div>
  );
}

function Ligne({ libelle, valeur, action }: { libelle: string; valeur: number; action: () => void }) {
  return (
    <li className="flex items-center justify-between py-2">
      <span>{libelle}</span>
      <button onClick={action} className="inline-flex items-center gap-1.5 tabular-nums hover:underline">
        <span className={valeur > 0 ? "font-semibold text-accent" : "text-texte-3"}>{formatNombre(valeur)}</span>
        <ArrowRight size={13} className="text-texte-3" />
      </button>
    </li>
  );
}

/** Chaque service, mesuré d'ici : le temps de réponse dit s'il va bien, et si l'utilisateur doit s'attendre à des lenteurs. */
async function mesurerServices() {
  const site = adresseSite();
  const mesure = async (nom: string, url: string, lent = 2500): Promise<{ nom: string; etat: Etat; detail: string }> => {
    const debut = performance.now();
    try {
      const r = await fetch(url, { cache: "no-store" });
      const ms = Math.round(performance.now() - debut);
      if (!r.ok) return { nom, etat: "panne", detail: `réponse ${r.status}` };
      return { nom, etat: ms > lent ? "lent" : "ok", detail: `${ms} ms` };
    } catch {
      return { nom, etat: "panne", detail: "injoignable" };
    }
  };
  return Promise.all([
    mesure("Site et base de données", `${site}/api/site-config`),
    mesure("Lecture audio (Cloudflare)", "https://karaks-lecture.dodisoa-nandrianina.workers.dev/sante", 1500),
    mesure("Envoi de fichiers (Karaks Storage)", `${site}/api/fichiers/envoi`),
  ]);
}
