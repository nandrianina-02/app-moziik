import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, CircleSlash, Gauge, Play, Square } from "lucide-react";
import { api, telechargerAuthentifie } from "../api";
import { estimerTempo } from "../bpm";
import { Barres, Bouton, Carte, EnTete, Erreur, Table, formatNombre } from "../composants";
import { BoutonEcoute } from "../lecture";
import { annoncer, confirmer } from "../interactions";
import clsx from "../clsx";

/*
 * La mesure du tempo des titres qui n'en ont pas. Huit des douze modes
 * d'écoute en dépendent. Le site ne fait que fournir la liste et garder le
 * résultat : l'analyse tourne ici, comme sur la page web, avec la même
 * méthode (bpm.ts).
 *
 * L'état vit hors de la page : la mesure continue quand on va ailleurs, et
 * on retrouve l'avancement en revenant.
 */

interface Titre {
  _id: string;
  title: string;
  artistName?: string;
}

interface Resultat {
  titre: Titre;
  etat: "ecrit" | "ignore" | "erreur";
  bpm?: number;
  raison?: string;
}

interface Etat {
  enCours: boolean;
  arretDemande: boolean;
  restants: number | null;
  resultats: Resultat[];
  erreur: string | null;
}

let etat: Etat = { enCours: false, arretDemande: false, restants: null, resultats: [], erreur: null };
const abonnes = new Set<() => void>();
const changer = (e: Partial<Etat>) => {
  etat = { ...etat, ...e };
  for (const f of abonnes) f();
};
const useEtat = () =>
  useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
  );

/** Deux à la fois : assez pour avancer, pas assez pour figer la fenêtre pendant le décodage. */
const EN_PARALLELE = 2;

async function compterRestants() {
  try {
    const { restants } = await api<{ restants: number }>("/api/admin/bpm?limite=1");
    changer({ restants });
  } catch (e) {
    changer({ erreur: e instanceof Error ? e.message : "Comptage impossible." });
  }
}

/** Analyse un titre et enregistre le résultat, ou dit pourquoi il n'y en a pas. */
async function traiter(titre: Titre): Promise<Resultat> {
  try {
    // Qualité basse : le tempo ne dépend pas du débit, et le fichier se
    // télécharge quatre fois plus vite.
    const estimation = await estimerTempo(await telechargerAuthentifie(`/api/stream/${titre._id}?q=low`));
    if (!estimation) return { titre, etat: "ignore", raison: "Aucun tempo régulier détecté" };
    if (estimation.ambigu) {
      // Le double et la moitié se valaient : écrire l'un des deux rangerait
      // peut-être une berceuse dans « Sport ». On s'abstient, comme le site.
      return { titre, etat: "ignore", bpm: estimation.bpm, raison: `Ambigu : ${estimation.bpm} ou ${estimation.bpm * 2} BPM` };
    }
    await api(`/api/songs/${titre._id}`, { methode: "PATCH", corps: { bpm: estimation.bpm, bpmSource: "analyse" } });
    return { titre, etat: "ecrit", bpm: estimation.bpm };
  } catch (e) {
    return { titre, etat: "erreur", raison: e instanceof Error ? e.message : "Échec de l'analyse" };
  }
}

/** Un lot de 25, ou tout le catalogue lot après lot jusqu'à épuisement ou arrêt. */
async function lancer(toutLeCatalogue: boolean) {
  if (etat.enCours) return;
  changer({ enCours: true, arretDemande: false, resultats: [], erreur: null });
  try {
    do {
      const { titres, restants } = await api<{ titres: Titre[]; restants: number }>("/api/admin/bpm");
      changer({ restants });
      if (titres.length === 0) break;
      const file = [...titres];
      const ouvrier = async () => {
        while (file.length > 0 && !etat.arretDemande) {
          const titre = file.shift()!;
          const r = await traiter(titre);
          changer({ resultats: [r, ...etat.resultats], restants: Math.max(0, (etat.restants ?? 1) - 1) });
        }
      };
      await Promise.all(Array.from({ length: EN_PARALLELE }, ouvrier));
      // Un lot entièrement ignoré reviendrait tel quel au lot suivant (le site
      // ne marque pas les échecs) : on s'arrête plutôt que de tourner en rond.
      const ecritsDuLot = etat.resultats.slice(0, titres.length).filter((r) => r.etat === "ecrit").length;
      if (ecritsDuLot === 0) break;
    } while (toutLeCatalogue && !etat.arretDemande);
  } catch (e) {
    changer({ erreur: e instanceof Error ? e.message : "Chargement impossible." });
  } finally {
    const ecrits = etat.resultats.filter((r) => r.etat === "ecrit").length;
    changer({ enCours: false });
    annoncer(`${ecrits} tempo${ecrits > 1 ? "s" : ""} enregistré${ecrits > 1 ? "s" : ""}`);
    void compterRestants();
  }
}

export function Bpm() {
  const e = useEtat();
  useEffect(() => {
    if (!etat.enCours) void compterRestants();
  }, []);

  const ecrits = e.resultats.filter((r) => r.etat === "ecrit").length;
  const ignores = e.resultats.filter((r) => r.etat === "ignore").length;
  const erreurs = e.resultats.filter((r) => r.etat === "erreur").length;

  async function demarrer(tout: boolean) {
    const ok = await confirmer({
      titre: tout ? "Analyser tout le catalogue ?" : "Analyser 25 titres ?",
      message: tout
        ? `Les ${formatNombre(e.restants ?? 0)} titres sans tempo seront écoutés et mesurés, lot après lot. Cela peut prendre longtemps ; vous pouvez changer de page pendant ce temps.`
        : "Chaque titre est téléchargé en qualité basse, mesuré, puis son tempo est enregistré. Les tempos ambigus sont laissés de côté.",
      confirmer: "Lancer",
    });
    if (ok) void lancer(tout);
  }

  return (
    <>
      <EnTete
        titre="Tempo (BPM)"
        texte="Huit des douze modes d'écoute choisissent les titres selon leur tempo. La mesure se fait sur ce poste, avec la même méthode que le site."
        action={
          e.enCours ? (
            <Bouton variante="danger" onClick={() => changer({ arretDemande: true })} disabled={e.arretDemande}>
              <Square size={14} /> {e.arretDemande ? "Arrêt après les titres en cours…" : "Arrêter"}
            </Bouton>
          ) : (
            <>
              <Bouton variante="trait" disabled={!e.restants} onClick={() => void demarrer(false)}>
                <Play size={14} /> Un lot de 25
              </Bouton>
              <Bouton disabled={!e.restants} onClick={() => void demarrer(true)}>
                <Gauge size={14} /> Tout analyser
              </Bouton>
            </>
          )
        }
      />
      <Erreur message={e.erreur} />

      <div className="mb-5 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Tuile libelle="Titres sans tempo" valeur={e.restants === null ? "…" : formatNombre(e.restants)} />
        <Tuile libelle="Tempos enregistrés" valeur={formatNombre(ecrits)} ton="succes" />
        <Tuile libelle="Laissés de côté" valeur={formatNombre(ignores)} ton="attention" />
        <Tuile libelle="Erreurs" valeur={formatNombre(erreurs)} ton={erreurs ? "danger" : undefined} />
      </div>

      {e.enCours && (
        <Carte className="animate-monter mb-5">
          <div className="flex items-center gap-3 text-[13px]">
            <Barres /> Mesure en cours : {formatNombre(e.resultats.length)} titre{e.resultats.length > 1 ? "s" : ""} traité{e.resultats.length > 1 ? "s" : ""}. Vous pouvez changer de page.
          </div>
        </Carte>
      )}

      {e.resultats.length > 0 ? (
        <Table entetes={["", "Titre", "Artiste", { libelle: "Tempo", droite: true, largeur: "90px" }, { libelle: "Résultat", largeur: "320px" }]}>
          {e.resultats.map((r) => (
            <tr key={r.titre._id} className="animate-paraitre">
              <td className="w-12">
                <BoutonEcoute id={r.titre._id} depart={0.35} taille={30} />
              </td>
              <td className="font-medium">{r.titre.title}</td>
              <td className="text-texte-2">{r.titre.artistName ?? "—"}</td>
              <td className="text-right font-semibold tabular-nums">{r.bpm ?? "—"}</td>
              <td>
                <span className={clsx("inline-flex items-center gap-1.5 text-[12.5px]", r.etat === "ecrit" ? "text-succes" : r.etat === "ignore" ? "text-attention" : "text-danger")}>
                  {r.etat === "ecrit" ? <CheckCircle2 size={14} /> : r.etat === "ignore" ? <CircleSlash size={14} /> : <CircleAlert size={14} />}
                  {r.etat === "ecrit" ? "Enregistré" : r.raison}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        !e.enCours && (
          <p className="py-10 text-center text-[13px] text-texte-3">
            {e.restants === 0 ? "Tous les titres ont un tempo." : "Lancez une analyse : les résultats s'afficheront ici au fil de l'eau."}
          </p>
        )
      )}
    </>
  );
}

function Tuile({ libelle, valeur, ton }: { libelle: string; valeur: string; ton?: "succes" | "attention" | "danger" }) {
  return (
    <div className="animate-monter rounded-2xl border border-filet bg-surface p-5">
      <div className="text-[12px] text-texte-3">{libelle}</div>
      <div className={clsx("mt-1 font-titre text-[24px] font-semibold tabular-nums", ton === "succes" && "text-succes", ton === "attention" && "text-attention", ton === "danger" && "text-danger")}>{valeur}</div>
    </div>
  );
}
