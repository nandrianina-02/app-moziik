import { useEffect, useState } from "react";
import { BadgeCheck, Crown, Link2, Megaphone, Send, Users } from "lucide-react";
import { api } from "../api";
import { Bouton, Carte, Champ, Chargement, Dialogue, EnTete, Erreur, Vide, ZoneTexte, formatNombre, formatRelatif } from "../composants";
import clsx from "../clsx";

type Public = "tous" | "artistes" | "premium";

interface Annonce {
  _id: string;
  titre: string;
  message: string;
  lien?: string;
  public: Public;
  destinataires: number;
  auteur?: { name: string } | null;
  createdAt: string;
}

const PUBLICS: { cle: Public; libelle: string; icone: typeof Users }[] = [
  { cle: "tous", libelle: "Tous les comptes", icone: Users },
  { cle: "artistes", libelle: "Artistes", icone: BadgeCheck },
  { cle: "premium", libelle: "Abonnés Premium", icone: Crown },
];

/**
 * Les annonces : une notification à chaque destinataire, et un push sur
 * ses téléphones. Le site écarte de lui-même les comptes suspendus et les
 * profils d'artistes créés par l'administration (adresse @moziik.app),
 * d'où des effectifs plus bas que le nombre de comptes.
 */
export function Annonces() {
  const [annonces, setAnnonces] = useState<Annonce[] | null>(null);
  const [effectifs, setEffectifs] = useState<Partial<Record<Public, number>>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [lien, setLien] = useState("");
  const [cible, setCible] = useState<Public>("tous");
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [envoyee, setEnvoyee] = useState<string | null>(null);

  const charger = () =>
    api<{ annonces: Annonce[]; publics: Record<Public, number> }>("/api/admin/annonces")
      .then((r) => {
        setAnnonces(r.annonces ?? []);
        setEffectifs(r.publics ?? {});
      })
      .catch((e: Error) => setErreur(e.message));
  useEffect(() => {
    void charger();
  }, []);

  const pret = titre.trim().length > 0 && message.trim().length > 0;

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    try {
      const { annonce } = await api<{ annonce: Annonce }>("/api/admin/annonces", {
        corps: { titre: titre.trim(), message: message.trim(), lien: lien.trim() || undefined, public: cible },
      });
      setEnvoyee(`Annonce envoyée à ${formatNombre(annonce.destinataires)} personne${annonce.destinataires > 1 ? "s" : ""}.`);
      setTitre("");
      setMessage("");
      setLien("");
      void charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi refusé.");
    } finally {
      setEnCours(false);
      setConfirmer(false);
    }
  }

  return (
    <>
      <EnTete titre="Annonces" texte="Une notification dans l'application et un push sur les téléphones." />
      <div className="grid grid-cols-12 gap-5">
        <Carte titre="Nouvelle annonce" className="animate-monter decale-1 col-span-12 xl:col-span-7">
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-texte-2">Destinataires</span>
              <div className="grid grid-cols-3 gap-2.5">
                {PUBLICS.map((p) => (
                  <button
                    key={p.cle}
                    onClick={() => setCible(p.cle)}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      cible === p.cle ? "border-accent bg-accent/10" : "border-filet hover:bg-surface-2",
                    )}
                  >
                    <p.icone size={18} className={cible === p.cle ? "text-accent" : "text-texte-3"} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{p.libelle}</span>
                      <span className="block text-[12px] text-texte-3 tabular-nums">{effectifs[p.cle] === undefined ? "…" : `${formatNombre(effectifs[p.cle]!)} personnes`}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Champ libelle="Titre" maxLength={120} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Nouvelle fonctionnalité : les paroles synchronisées" />
            <ZoneTexte libelle="Message" maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} className="[&_textarea]:min-h-[160px]" placeholder="Le texte de l'annonce" />
            <Champ libelle="Lien (facultatif)" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="/titres ou https://…" aide="Une page du site, qui commence par /, ou une adresse https://." />
            <Erreur message={erreur} />
            {envoyee && <p className="animate-paraitre rounded-lg bg-succes/10 px-3 py-2 text-[13px] text-succes">{envoyee}</p>}
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[12px] text-texte-3 tabular-nums">{message.length} / 4000</span>
              <Bouton disabled={!pret} onClick={() => (setEnvoyee(null), setConfirmer(true))} className="h-10 px-4">
                <Send size={15} /> Envoyer l'annonce
              </Bouton>
            </div>
          </div>
        </Carte>

        <Carte titre="Aperçu" className="animate-monter decale-2 col-span-12 xl:col-span-5">
          <div className="rounded-xl border border-filet bg-surface-2 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <Megaphone size={16} />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold break-words">{titre.trim() || "Titre de l'annonce"}</div>
                <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-texte-2 break-words">{message.trim() || "Le message apparaîtra ici, tel que les destinataires le liront."}</p>
                {lien.trim() && (
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent">
                    <Link2 size={13} /> {lien.trim()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Carte>

        <Carte titre="Annonces envoyées" className="animate-monter decale-3 col-span-12">
          {!annonces && !erreur ? (
            <Chargement />
          ) : !annonces || annonces.length === 0 ? (
            <Vide texte="Aucune annonce envoyée pour l'instant." />
          ) : (
            <ul className="divide-y divide-filet">
              {annonces.map((a) => {
                const p = PUBLICS.find((x) => x.cle === a.public) ?? PUBLICS[0];
                return (
                  <li key={a._id} className="flex gap-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-texte-2">
                      <p.icone size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13.5px] font-semibold">{a.titre}</span>
                        <span className="shrink-0 text-[12px] text-texte-3">{formatRelatif(a.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] text-texte-2">{a.message}</p>
                      <div className="mt-1 text-[12px] text-texte-3">
                        {p.libelle} · {formatNombre(a.destinataires)} destinataire{a.destinataires > 1 ? "s" : ""}
                        {a.auteur?.name ? ` · par ${a.auteur.name}` : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      </div>

      {confirmer && (
        <Dialogue titre="Envoyer l'annonce ?" onFermer={() => !enCours && setConfirmer(false)}>
          <p className="text-[13px] leading-relaxed text-texte-2">
            « {titre.trim()} » partira tout de suite vers {effectifs[cible] !== undefined ? <strong className="text-texte">{formatNombre(effectifs[cible]!)} personnes</strong> : "ce public"} ({PUBLICS.find((p) => p.cle === cible)?.libelle.toLowerCase()}). Une annonce envoyée ne se retire pas.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Bouton variante="discret" disabled={enCours} onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton enCours={enCours} onClick={() => void envoyer()}>
              <Send size={14} /> Envoyer
            </Bouton>
          </div>
        </Dialogue>
      )}
    </>
  );
}
