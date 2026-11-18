import { useEffect, useState } from "react";
import { BookOpen, CircleAlert, Mail, MessagesSquare, Percent, RefreshCw, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../api";
import { Bouton, Carte, Chargement, EnTete, Erreur, Pastille, Vide, formatNombre, formatRelatif } from "../composants";
import clsx from "../clsx";
import { annoncer, copier, ouvrirMenu } from "../interactions";

interface Escalade {
  _id: string;
  membre: string;
  email: string;
  statut: "open" | "closed" | string;
  dernierMessageLe: string | null;
  questions: string[];
}

interface Mot {
  mot: string;
  occurrences: number;
  couvert: boolean;
}

interface Reponse {
  escalades: Escalade[];
  mots: Mot[];
  resume: { fils: number; escalades: number; articles: number; taux: number };
}

/**
 * Ce que l'assistant de l'aide a passé à un humain, en lecture seule
 * (/api/admin/support/escalades). L'écran sert à choisir le prochain
 * article du centre d'aide : un mot fréquent qu'aucun article ne couvre
 * est un article à écrire. Il ne juge pas si l'escalade était évitable.
 */
export function Escalades() {
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setDonnees(null);
    setErreur(null);
    api<Reponse>("/api/admin/support/escalades")
      .then((r) => setDonnees({ escalades: r.escalades ?? [], mots: r.mots ?? [], resume: r.resume }))
      .catch((e: Error) => setErreur(e.message));
  }, [version]);

  function menuFil(e: React.MouseEvent, f: Escalade) {
    ouvrirMenu(e, [{ libelle: "Copier l'e-mail", icone: Mail, desactive: !f.email, action: () => void copier(f.email).then(() => annoncer("E-mail copié")) }], f.membre);
  }

  const resume = donnees?.resume;
  const nonCouverts = donnees?.mots.filter((m) => !m.couvert).length ?? 0;

  return (
    <>
      <EnTete
        titre="Escalades"
        texte="Les conversations que l'assistant a passées à un humain, et les mots qui y reviennent."
        action={
          <Bouton variante="trait" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} /> Actualiser
          </Bouton>
        }
      />
      <Erreur message={erreur} />
      {!donnees ? (
        !erreur && <Chargement />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Mesure classe="decale-1" icone={MessagesSquare} libelle="Conversations" valeur={formatNombre(resume?.fils)} />
            <Mesure classe="decale-2" icone={UserRound} libelle="Passées à un humain" valeur={formatNombre(resume?.escalades)} />
            <Mesure classe="decale-3" icone={BookOpen} libelle="Articles d'aide publiés" valeur={formatNombre(resume?.articles)} />
            <Mesure classe="decale-4" icone={Percent} libelle="Taux d'escalade" valeur={typeof resume?.taux === "number" ? `${resume.taux} %` : "—"} />
          </div>

          <Carte
            className="animate-monter decale-5"
            titre="Mots fréquents"
            action={
              nonCouverts > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-attention">
                  <CircleAlert size={14} /> {nonCouverts} sans article
                </span>
              )
            }
          >
            <p className="mb-4 text-[12.5px] leading-relaxed text-texte-2">
              Les mots des questions escaladées, du plus fréquent au moins fréquent. Un mot qu'aucun article publié ne contient (synonymes compris) est un article à écrire ;
              un mot couvert qui revient souvent signale plutôt un article à compléter ou mal titré.
            </p>
            {donnees.mots.length === 0 ? (
              <Vide texte="Pas encore assez de questions pour dégager des mots." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {donnees.mots.map((m) => (
                  <span
                    key={m.mot}
                    title={m.couvert ? "Un article publié en parle" : "Aucun article publié n'en parle"}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[12.5px]",
                      m.couvert ? "border-filet bg-surface-2 text-texte-2" : "border-attention/40 bg-attention/10 font-medium text-attention",
                    )}
                  >
                    {m.mot}
                    <span className={clsx("text-[11px] tabular-nums", m.couvert ? "text-texte-3" : "text-attention/80")}>{m.occurrences}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-5 text-[11.5px] text-texte-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-attention/40 bg-attention/10" /> sans article
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-filet bg-surface-2" /> couvert par un article
              </span>
            </div>
          </Carte>

          <section className="animate-monter decale-6">
            <h2 className="mb-1 flex items-baseline gap-2 font-titre text-[15px] font-semibold">
              Conversations escaladées
              <span className="text-[12px] font-normal text-texte-3 tabular-nums">{donnees.escalades.length}</span>
            </h2>
            <p className="mb-3 text-[12.5px] text-texte-3">Les plus récentes d'abord, avec les dernières questions posées par le membre.</p>
            {donnees.escalades.length === 0 ? (
              <Vide texte="Aucune conversation n'a été passée à un humain." />
            ) : (
              <div className="divide-y divide-filet overflow-hidden rounded-2xl border border-filet bg-surface">
                {donnees.escalades.map((f) => (
                  <article key={f._id} onContextMenu={(e) => menuFil(e, f)} className="px-5 py-4">
                    <header className="flex items-center gap-3">
                      <Users size={15} className="shrink-0 text-texte-3" />
                      <span className="truncate text-[13.5px] font-semibold">{f.membre}</span>
                      {f.email && (
                        <span className="truncate text-[12px] text-texte-3" data-selectionnable>
                          {f.email}
                        </span>
                      )}
                      <span className="ml-auto flex shrink-0 items-center gap-2 text-[12px] text-texte-3">
                        {f.dernierMessageLe && <span>{formatRelatif(f.dernierMessageLe)}</span>}
                        {f.statut === "closed" ? <Pastille texte="close" /> : <Pastille texte="ouverte" ton="attention" />}
                      </span>
                    </header>
                    {f.questions.length > 0 ? (
                      <ul className="mt-2.5 space-y-1.5 border-l-2 border-filet pl-3.5">
                        {f.questions.map((q, i) => (
                          <li key={i} className="text-[12.5px] leading-relaxed text-texte-2">
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[12px] text-texte-3">Aucune question écrite par le membre.</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Mesure({ icone: Icone, libelle, valeur, classe }: { icone: LucideIcon; libelle: string; valeur: string; classe: string }) {
  return (
    <div className={clsx("animate-monter rounded-2xl border border-filet bg-surface px-5 py-4", classe)}>
      <div className="flex items-center gap-2 text-[12px] text-texte-3">
        <Icone size={14} /> {libelle}
      </div>
      <div className="mt-1.5 font-titre text-[24px] font-semibold tabular-nums">{valeur}</div>
    </div>
  );
}
