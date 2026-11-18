import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Download, ExternalLink, LayoutGrid, Loader2, Monitor, Moon, RefreshCcw, RotateCcw, Sun, type LucideIcon } from "lucide-react";
import { api } from "../api";
import { useSession } from "../session";
import { Bascule, Bouton, Carte, Champ, EnTete, Selection } from "../composants";
import { PAR_DEFAUT, ZOOMS, reglerPreferences, reinitialiserPreferences, usePreferences, type ChoixTheme } from "../preferences";
import { reinitialiserVues } from "../vues";
import { useTeleversements } from "../televersements";
import { confirmer } from "../interactions";
import { derniereVersion, plusRecente } from "../miseajour";
import { NAVIGATION } from "../App";
import clsx from "../clsx";

// Toutes les pages de la barre latérale, sauf celle-ci : la liste suit la navigation.
// Calculée à l'affichage : App importe ce fichier, et NAVIGATION n'existe pas encore
// quand ce module se charge.
const pagesDemarrage = (): [string, string][] => NAVIGATION.filter((p) => p.cle !== "reglages").map((p) => [p.cle, p.libelle]);

const ACTUALISATIONS: [number, string][] = [
  [60, "Toutes les minutes"],
  [120, "Toutes les 2 minutes"],
  [300, "Toutes les 5 minutes"],
  [0, "Jamais (bouton Actualiser seulement)"],
];


const THEMES: { cle: ChoixTheme; libelle: string; icone: LucideIcon }[] = [
  { cle: "sombre", libelle: "Sombre", icone: Moon },
  { cle: "clair", libelle: "Clair", icone: Sun },
  { cle: "systeme", libelle: "Système", icone: Monitor },
];

/**
 * Les paramètres de ce poste. Tout est enregistré localement et s'applique
 * aussitôt : pas de bouton Enregistrer, sauf pour l'adresse du site, dont
 * le changement ferme la session.
 */
export function Reglages() {
  const { site, changerSite, etat } = useSession();
  const prefs = usePreferences();
  const [saisi, setSaisi] = useState(site);
  const [version, setVersion] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [vuesEffacees, setVuesEffacees] = useState(false);
  useEffect(() => {
    void window.bureau.version().then(setVersion);
    api<{ genres?: string[] }>("/api/site-config")
      .then((c) => setGenres(c.genres ?? []))
      .catch(() => undefined);
  }, []);
  const utilisateur = etat.phase === "connecte" ? etat.utilisateur : null;

  return (
    <>
      <EnTete
        titre="Paramètres"
        texte="Propres à ce poste, appliqués aussitôt."
        action={
          <Bouton
            variante="trait"
            onClick={() =>
              void confirmer({
                titre: "Revenir aux valeurs d'origine ?",
                message: "Thème, taille de l'interface, page d'ouverture, réglages des téléversements et affichage des listes reprennent leur valeur par défaut, sur ce poste seulement.",
                confirmer: "Réinitialiser",
                danger: true,
              }).then((ok) => {
                if (!ok) return;
                reinitialiserPreferences();
                reinitialiserVues();
              })
            }
          >
            <RotateCcw size={14} /> Valeurs d'origine
          </Bouton>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte titre="Apparence" className="animate-monter decale-1">
          <Ligne libelle="Thème" aide="« Système » suit le réglage de Windows, en direct.">
            <div className="flex rounded-lg border border-filet bg-surface-2 p-0.5">
              {THEMES.map((t) => (
                <button
                  key={t.cle}
                  onClick={() => reglerPreferences({ theme: t.cle })}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    prefs.theme === t.cle ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte",
                  )}
                >
                  <t.icone size={14} /> {t.libelle}
                </button>
              ))}
            </div>
          </Ligne>
          <Ligne libelle="Taille de l'interface" aide="Textes, icônes et marges ensemble. Raccourcis : Ctrl + + et Ctrl + −, Ctrl + 0 pour revenir à 100 %.">
            <div className="flex rounded-lg border border-filet bg-surface-2 p-0.5">
              {ZOOMS.map((z) => (
                <button
                  key={z}
                  onClick={() => reglerPreferences({ zoom: z })}
                  className={clsx("rounded-md px-3 py-1.5 text-[12.5px] font-medium tabular-nums transition-colors", prefs.zoom === z ? "bg-accent text-sur-accent" : "text-texte-2 hover:text-texte")}
                >
                  {Math.round(z * 100)} %
                </button>
              ))}
            </div>
          </Ligne>
          <Bascule
            libelle="Animations"
            aide="Entrées des panneaux, passage d'une vue à l'autre, barres de chargement. Windows peut aussi les réduire pour tout le système."
            valeur={prefs.animations}
            onChange={(v) => reglerPreferences({ animations: v })}
          />
          <Ligne libelle="Affichage des listes" aide="Liste ou grille, et taille, retenues page par page. Raccourci : Ctrl + molette sur une liste, comme dans l'Explorateur Windows.">
            <Bouton
              variante="trait"
              className="h-8"
              onClick={() => {
                reinitialiserVues();
                setVuesEffacees(true);
              }}
            >
              <LayoutGrid size={14} /> {vuesEffacees ? "Réinitialisé" : "Réinitialiser"}
            </Bouton>
          </Ligne>
        </Carte>

        <Carte titre="Démarrage et actualisation" className="animate-monter decale-2">
          <Ligne libelle="Page d'ouverture" aide="Celle qui s'affiche au lancement du logiciel.">
            <Selection value={prefs.pageDemarrage} onChange={(e) => reglerPreferences({ pageDemarrage: e.target.value })} className="w-52">
              {pagesDemarrage().map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </Selection>
          </Ligne>
          <Ligne libelle="Actualisation des compteurs" aide="La cloche, les pastilles de la barre latérale et les chiffres du tableau de bord.">
            <Selection value={prefs.actualisation} onChange={(e) => reglerPreferences({ actualisation: Number(e.target.value) })} className="w-52">
              {ACTUALISATIONS.map(([s, libelle]) => (
                <option key={s} value={s}>
                  {libelle}
                </option>
              ))}
            </Selection>
          </Ligne>
        </Carte>

        <Carte titre="Téléversements" className="animate-monter decale-3">
          <Bascule
            libelle="Préparer les qualités d'écoute"
            aide="64 kb/s (mono), 128 et 320 kb/s encodés avant publication, comme sur le site : les petits forfaits écoutent la version légère. Plus long ; sans cela, tout le monde reçoit le fichier d'origine."
            valeur={prefs.qualites}
            onChange={(v) => reglerPreferences({ qualites: v })}
          />
          <Ligne libelle="Genre par défaut" aide="Donné aux fichiers dont la balise est vide ou inconnue du site ; modifiable ligne par ligne avant l'envoi.">
            <Selection value={prefs.genreDefaut} onChange={(e) => reglerPreferences({ genreDefaut: e.target.value })} className="w-52">
              {[...new Set([prefs.genreDefaut, ...genres])].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Selection>
          </Ligne>
          <Bascule
            libelle="Notification à la fin"
            aide="Une notification Windows quand un envoi se termine, utile si vous travaillez dans une autre application."
            valeur={prefs.notifications}
            onChange={(v) => reglerPreferences({ notifications: v })}
          />
        </Carte>

        <MisesAJour version={version} />

        <Carte titre="Site administré" className="animate-monter decale-5">
          <p className="mb-3 text-[13px] text-texte-2">L'adresse du site Moziik auquel ce logiciel se connecte. La changer ferme la session : les comptes ne sont pas les mêmes d'un site à l'autre.</p>
          <div className="flex items-end gap-2">
            <Champ libelle="Adresse" value={saisi} onChange={(e) => setSaisi(e.target.value)} className="flex-1" />
            <Bouton variante="trait" disabled={saisi.trim().replace(/\/+$/, "") === site} onClick={() =>
                void confirmer({
                  titre: "Changer de site administré ?",
                  message: "La session se ferme : il faudra se connecter avec un compte administrateur de ce site.",
                  confirmer: "Changer de site",
                  danger: true,
                }).then((ok) => ok && void changerSite(saisi))
              }>
              Enregistrer
            </Bouton>
          </div>
        </Carte>

        <Carte titre="Compte" className="animate-monter decale-6">
          <p className="text-[13px]">
            {utilisateur?.name} <span className="text-texte-3">({utilisateur?.email})</span>
          </p>
          <p className="mt-1 text-[12px] text-texte-3">La session reste ouverte sur ce PC, chiffrée par Windows pour votre compte utilisateur. Déconnectez-vous depuis le menu du compte sur un PC partagé.</p>
          <div className="mt-3 flex gap-3 text-[13px]">
            <button onClick={() => void window.bureau.ouvrirExterne(`${site}/admin`)} className="inline-flex items-center gap-1 text-accent hover:underline">
              Administration du site <ExternalLink size={13} />
            </button>
          </div>
        </Carte>
      </div>
      {prefs.genreDefaut !== PAR_DEFAUT.genreDefaut && genres.length > 0 && !genres.includes(prefs.genreDefaut) && (
        <p className="mt-4 text-[12px] text-attention">Le genre par défaut « {prefs.genreDefaut} » n'existe plus sur le site : choisissez-en un autre.</p>
      )}
    </>
  );
}

/** Une ligne de réglage : libellé et explication à gauche, commande à droite. */
function Ligne({ libelle, aide, children }: { libelle: string; aide?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-filet py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{libelle}</div>
        {aide && <div className="mt-0.5 text-[12px] text-texte-3">{aide}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * La dernière version publiée du logiciel. Les versions du logiciel portent
 * l'étiquette admin-vX.Y.Z et ne sont jamais « latest » (l'application
 * Android lit celle-là) : on parcourt donc la liste des versions.
 */
function MisesAJour({ version }: { version: string }) {
  const { phase: phaseEnvoi } = useTeleversements();
  const [installation, setInstallation] = useState<{ pourcent: number } | { erreur: string } | null>(null);
  const [etat, setEtat] = useState<{ phase: "attente" } | { phase: "erreur" } | { phase: "pret"; derniere: string; lien: string } | null>(null);

  async function verifier() {
    setEtat({ phase: "attente" });
    try {
      const { version: derniere, lien } = await derniereVersion();
      setEtat({ phase: "pret", derniere, lien });
    } catch {
      setEtat({ phase: "erreur" });
    }
  }

  useEffect(() => {
    if (version) void verifier();
  }, [version]);

  async function installer(lien: string) {
    // Fermer le logiciel couperait un envoi en cours au milieu d'un fichier.
    const ok = await confirmer({
      titre: "Installer la mise à jour ?",
      message:
        phaseEnvoi !== "repos"
          ? "Un téléversement est en cours : l'installation fermera le logiciel et l'interrompra. Le titre en cours d'envoi ne sera pas publié."
          : "Le logiciel télécharge l'installeur, le lance et se ferme. Réglages et session sont conservés.",
      confirmer: "Installer",
      danger: phaseEnvoi !== "repos",
    });
    if (!ok) return;
    setInstallation({ pourcent: 0 });
    const desabonner = window.bureau.miseAJour.surProgression((pourcent) => setInstallation({ pourcent }));
    try {
      await window.bureau.miseAJour.installer(lien);
    } catch (e) {
      setInstallation({ erreur: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Installation impossible." });
    } finally {
      desabonner();
    }
  }

  const nouvelle = etat?.phase === "pret" && plusRecente(etat.derniere, version);
  return (
    <Carte
      titre="Mises à jour"
      className="animate-monter decale-4"
      action={
        <Bouton variante="discret" className="h-8" onClick={() => void verifier()} disabled={etat?.phase === "attente"}>
          <RefreshCcw size={14} /> Vérifier
        </Bouton>
      }
    >
      <div className="flex items-center gap-3">
        {etat?.phase === "attente" ? (
          <Loader2 size={18} className="animate-spin text-texte-3" />
        ) : nouvelle ? (
          <Download size={18} className="text-accent" />
        ) : (
          <CheckCircle2 size={18} className={etat?.phase === "pret" ? "text-succes" : "text-texte-3"} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">
            {etat?.phase === "pret" ? (nouvelle ? `Version ${etat.derniere} disponible` : "Le logiciel est à jour") : etat?.phase === "erreur" ? "Vérification impossible" : "Vérification…"}
          </div>
          <div className="text-[12px] text-texte-3">Version installée : {version || "…"}</div>
        </div>
        {nouvelle && etat?.phase === "pret" && (
          <Bouton enCours={installation !== null && "pourcent" in installation} onClick={() => void installer(etat.lien)}>
            <Download size={14} /> {installation && "pourcent" in installation ? `${installation.pourcent} %` : "Installer"}
          </Bouton>
        )}
      </div>
      {installation && "pourcent" in installation && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${installation.pourcent}%` }} />
        </div>
      )}
      {installation && "erreur" in installation && <p className="mt-3 text-[12.5px] text-danger">{installation.erreur}</p>}
      <p className="mt-3 text-[12px] text-texte-3">
        Le logiciel télécharge l'installeur, le lance et se ferme pour lui laisser la place. Réglages et session sont conservés.
      </p>
    </Carte>
  );
}
